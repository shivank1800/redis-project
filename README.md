# Real-Time Social Feed + Notification System (Redis-Centric Architecture)

A production-style backend where **Redis is the primary data plane** — not a cache bolted onto Postgres, but the authoritative store for feeds, notifications, trending content, rate limits, sessions, job queues, and analytics.

PostgreSQL is used only for long-term durable storage (users, posts, likes, comments, follows, notification archive). Everything on the hot path goes through Redis.

---

## Features

| Feature | Redis structure used | Why |
|---|---|---|
| User profile cache | `STRING` (JSON) + TTL | Read-through, jittered expiry to avoid stampede |
| Home feed | `ZSET` (score = post timestamp) | O(log N) inserts, `ZREVRANGE` for top-K |
| Fan-out on write (normal users) | `ZADD` batches from a worker | Low read latency at write-time cost |
| Fan-out on read (celebrities) | `ZUNION`-style merge at query-time | Avoids N-million-key write storms |
| Like / comment / follow counters | `INCR` / `DECR` / `SETS` | Single-digit ms under load |
| Likes set per post | `SET` | O(1) "did user X like post Y?" |
| Social graph (followers/following) | `SET` | Fast `SMEMBERS`, `SRANDMEMBER` |
| Notifications (durable) | `STREAM` per user + consumer groups | Replay, retry, back-pressure |
| Notifications (live push) | `PUB/SUB` over WebSocket | <1ms delivery when online |
| Rate limiting | `ZSET` sliding window OR hash token bucket, Lua-atomic | Distributed, per-user/IP |
| Trending posts | `ZSET` with `likes × exp(-λ × age_hours)` | Self-decaying, no cron needed |
| Job queue (fan-out, notif persistence) | `STREAM` + consumer groups + `XAUTOCLAIM` | Durable, load-balanced, crash-safe |
| Sessions (server-side revocable) | `HASH` + `SET` index + TTL | Instant logout, logout-all |
| Distributed locks | `SET NX EX` + Lua CAS-delete | Safe critical sections |
| DAU (daily active users) | `HyperLogLog` | ~1.6% error in 12KB regardless of N |
| Leaderboard | `ZSET` (karma score) | `ZINCRBY` + `ZREVRANGE` |
| Recent activity search | Capped `LIST` (`LPUSH` + `LTRIM`) | Cheap rolling log |
| Unique post viewers | `HyperLogLog` per post | Cardinality without SETs |

---

## Architecture (logical)

```
                    ┌──────────────────────────────────────┐
                    │              HTTP / WS               │
                    └───────────────┬──────────────────────┘
                                    │
                  ┌─────────────────▼──────────────────┐
                  │  FastAPI  (rate-limit middleware)  │
                  └───┬────────────┬───────────────┬───┘
                      │            │               │
              ┌───────▼──┐   ┌─────▼──────┐   ┌────▼─────┐
              │ Services │   │  Redis     │   │Postgres  │
              │ (logic)  │──▶│ (hot path) │◀─▶│(durable) │
              └───┬──────┘   └──┬──────┬──┘   └──────────┘
                  │             │      │
                  │       ┌─────▼──┐  ┌▼───────────┐
                  │       │Streams │  │Pub/Sub     │
                  │       └──┬─────┘  └────┬───────┘
                  │          │             │
    ┌─────────────▼──┐   ┌───▼────────┐  ┌─▼──────────────┐
    │ fanout-worker  │   │ notif-     │  │ WebSocket      │
    │ (XREADGROUP)   │   │ worker     │  │ tail per user  │
    └────────────────┘   └────────────┘  └────────────────┘
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the deep-dive on scaling, failure modes, and consistency trade-offs.

---

## Quick start (Podman, recommended — Docker also works)

**You do not need a `.env` file** — defaults are in `docker-compose.yml`.
The `Makefile` auto-detects your container engine (Podman preferred,
Docker as fallback).

**macOS + Podman:** after `brew install podman`, also install a Compose provider
or **`podman compose`** will fail (see **[PODMAN.md](./PODMAN.md) §2**). The usual
one-liner:

Run **one block at a time** (pasting several lines into one `brew` command will
error with *accepts at most 1 arg*).

```bash
brew install podman docker-compose
```

```bash
podman machine init
podman machine start
```

```bash
cd /path/to/your/redis-project-clone
make up
```

Other ways to run:

```bash
make up
# or, explicitly:
podman compose up --build -d
# or, with Docker Desktop:
docker compose up --build -d
```

If the engine fails to start, read **[PODMAN.md](./PODMAN.md)** (or
**[DOCKER.md](./DOCKER.md)**) — covers machine startup, missing compose
providers, port conflicts, rootless quirks.

This brings up:
- `feed-redis` (Redis 7, AOF + RDB, LRU eviction, 512MB cap)
- `feed-postgres` (Postgres 16)
- `feed-api` (FastAPI on :8000)
- `feed-worker-fanout` (feed fan-out worker)
- `feed-worker-notifications` (notification persistence worker)
- `feed-frontend` (React + Vite UI on :5173)

Open:
- Frontend:  http://localhost:5173
- REST docs: http://localhost:8000/docs
- ReDoc:     http://localhost:8000/redoc
- Health:    http://localhost:8000/health
- Metrics:   http://localhost:8000/metrics

## Quick start (local venv)

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start Redis + Postgres only (Podman or Docker)
podman compose up -d redis postgres   # or: docker compose up -d redis postgres

# Terminal 1: API
uvicorn app.main:app --reload

# Terminal 2: fan-out worker
python -m app.workers.fanout_worker

# Terminal 3: notification worker
python -m app.workers.notification_worker
```

## Tests

```bash
pytest
```

35 tests covering:
- Cache read-through + stampede coalescing
- Sliding-window + token-bucket rate limiters
- Distributed lock exclusivity + safe release
- Redis Streams queue + consumer-group load balancing
- Feed fan-out + pruning + backfill
- Trending score decay
- HyperLogLog DAU + ZSET leaderboard
- Session create/revoke/revoke-all

---

## API walkthrough

### 1. Register + login

```bash
curl -X POST localhost:8000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"a@x.com","password":"supersecret"}'

TOKEN=$(curl -s -X POST localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"supersecret"}' | jq -r .access_token)
```

### 2. Create a post (goes to trending + fan-out queue)

```bash
curl -X POST localhost:8000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"content":"Hello Redis"}'
```

### 3. Follow another user (triggers feed backfill + notification)

```bash
curl -X POST localhost:8000/users/42/follow -H "Authorization: Bearer $TOKEN"
```

### 4. Like a post (counter → trending decay → notification)

```bash
curl -X POST localhost:8000/posts/17/like -H "Authorization: Bearer $TOKEN"
```

### 5. Home feed (ZSET top-K, hydrate posts from cache)

```bash
curl "localhost:8000/feed/home?limit=20" -H "Authorization: Bearer $TOKEN"
```

### 6. Trending

```bash
curl localhost:8000/feed/trending
```

### 7. Live notifications (WebSocket)

```javascript
const ws = new WebSocket(`ws://localhost:8000/notifications/ws?token=${TOKEN}`);
ws.onmessage = e => console.log(JSON.parse(e.data));
```

### 8. Analytics

```bash
curl "localhost:8000/analytics/dau?days=7"          # HyperLogLog
curl "localhost:8000/analytics/leaderboard?limit=10"
curl "localhost:8000/analytics/search?q=post:42"
```

---

## Why each Redis structure?

### `ZSET` for feed & trending
O(log N) `ZADD`, O(log N + K) `ZREVRANGE` for top-K. `ZREMRANGEBYRANK` keeps per-user feed capped (default 1000 entries). This is the exact same structure Twitter's early timeline used.

### `STREAM` for queues and notifications
Unlike `LIST` with `BRPOP`, streams support:
- Consumer groups (multiple workers, load-balanced)
- ACK / pending-entry list (PEL) — re-delivery on worker crash
- `XAUTOCLAIM` to recover stuck messages
- Replay from arbitrary ID

We pick streams over Kafka because we already run Redis, avoid adding a JVM dependency, and our throughput (sub-million events/s) fits comfortably on a single primary.

### `PUB/SUB` for live delivery only
Fire-and-forget, no persistence. Paired with a durable Stream for replay, this gives us the best-of-both: <1ms delivery when online, durable replay when reconnecting.

### `HyperLogLog` for DAU
Counting unique users with a `SET` would cost 16B+ × number-of-users per day. HLL uses a flat 12KB per key with ~1.6% error — ~10,000× cheaper at scale, and supports `PFMERGE` for rolled-up time ranges.

### Lua-atomic rate limiter
Sliding-window counts need `ZREMRANGEBYSCORE` + `ZCARD` + `ZADD` in one atomic step, otherwise two concurrent requests can both observe "under limit" and both pass. We push this to a single `EVALSHA` round-trip — zero races, zero extra network hops.

### `SET NX EX` distributed lock
A uniquely-tokened `SET NX EX` acquires, a Lua CAS-delete releases *only if we still own it*. Protects against: the classic bug where a slow Process A's lock expires, Process B acquires, Process A finishes and releases Process B's lock.

---

## Trade-offs vs a DB / Kafka stack

| Concern | Our choice | Alternative | Rationale |
|---|---|---|---|
| Durability | Redis AOF `appendonly yes` + RDB snapshots | Postgres only | Sub-millisecond reads, acceptable 1s-worth data-loss risk on power failure |
| Queue | Redis Streams | Kafka | Simpler ops, fewer moving parts, adequate throughput |
| Feed | Redis ZSET fan-out | Postgres query-time | Postgres query can't serve a top-20 feed in <1ms at scale |
| Real-time push | Redis Pub/Sub + Stream | Kafka + WS gateway | Half the moving parts, simpler reconnect semantics |
| Counters | Redis `INCR` | Postgres `UPDATE` | 100× throughput, no row-lock contention, periodic fold-back |
| Analytics | HyperLogLog / ZSET | Full OLAP DB | "Good enough" for DAU / leaderboards with fixed memory |

### Memory vs persistence
- Redis runs with `--maxmemory 512mb --maxmemory-policy allkeys-lru`, so cold keys (old post caches, inactive feeds) are evicted automatically.
- Feeds are capped per user (`feed_max_size`). Even 10M users × 1000 post IDs × 20B/entry ≈ 200GB — horizontally shardable by user_id.
- AOF `everysec` gives ≤1s data-loss on crash; for stronger guarantees switch to `appendfsync always` (much slower).
- Streams are capped by `MAXLEN ~ 100000` (approximate trim) per stream.

---

## Project layout

```
app/
├── api/                 # FastAPI routers + middleware + deps
│   ├── auth.py          # register / login / logout (Redis-backed sessions)
│   ├── users.py         # profile, follow / unfollow
│   ├── posts.py         # create, like, comment
│   ├── feed.py          # home feed, trending
│   ├── notifications.py # REST + WebSocket
│   ├── analytics.py     # DAU / leaderboard / search
│   ├── health.py
│   ├── middleware.py    # sliding-window rate limiter
│   └── deps.py
├── redis_layer/         # thin abstraction over redis-py
│   ├── client.py        # connection pool, lifecycle
│   ├── keys.py          # ALL key naming lives here
│   ├── cache.py         # read-through + stampede lock
│   ├── rate_limiter.py  # sliding window + token bucket (Lua)
│   ├── lock.py          # SETNX + CAS-delete lock
│   ├── queue.py         # Streams + consumer groups
│   └── pubsub.py        # ephemeral fan-out for WebSocket
├── services/            # business logic
│   ├── user_service.py
│   ├── follow_service.py
│   ├── post_service.py
│   ├── feed_service.py        # hybrid fan-out
│   ├── notification_service.py # stream + pubsub
│   ├── trending_service.py     # decayed ZSET
│   ├── session_service.py
│   └── analytics_service.py    # HLL + leaderboard
├── workers/
│   ├── fanout_worker.py        # XREADGROUP on jobs:fanout
│   └── notification_worker.py  # XREADGROUP on jobs:notifications
├── models/              # SQLAlchemy (Postgres long-term)
├── schemas/             # Pydantic request/response
├── config.py            # settings
├── database.py          # async engine + Base
├── security.py          # bcrypt + JWT
└── main.py              # FastAPI app
tests/                   # 35 unit tests — fakeredis-backed
```
