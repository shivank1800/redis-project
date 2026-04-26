# Architecture Deep-Dive

> This document covers the *why* behind the design: data-flow, scaling, failure modes, and consistency trade-offs.

---

## 1. Write-path anatomy (creating a post)

```
Client ──POST /posts──▶ FastAPI
                          │
                          ├─▶ Postgres INSERT posts (durable truth)
                          │
                          ├─▶ Redis pipeline:
                          │     ZADD feed:user:{author_id}   (own timeline)
                          │     ZREMRANGEBYRANK (cap at FEED_MAX_SIZE)
                          │     SET  cache:post:{id}          (pre-warm)
                          │
                          ├─▶ IF follower_count ≤ threshold:
                          │     XADD jobs:fanout {post, author, score}
                          │     └─▶ worker XREADGROUP
                          │             └─▶ ZADD feed:home:{follower_id} × N
                          │
                          ├─▶ ZADD trending:posts  (decayed score)
                          │
                          └─▶ XADD jobs:notifications (post author events)
```

Redis absorbs all the hot work; Postgres only stores the canonical row.

---

## 2. Feed: hybrid fan-out

### Fan-out on write (default path)
Each post's ID is pushed to every follower's `feed:home:{uid}` ZSET by a background worker consuming `jobs:fanout`. This makes `GET /feed/home` an O(log N + K) `ZREVRANGE` with zero merging.

**Cost:** 1 post × N followers = N writes. At 500 followers × 500-sized pipeline batches, ~1ms per batch on a single Redis primary.

### Fan-out on read (celebrity path)
If the author has > `CELEBRITY_FOLLOWER_THRESHOLD` (default 10k) followers, we skip writing to follower feeds and instead merge the celebrity's own `feed:user:{author_id}` ZSET at read-time.

**Why:** A Justin-Bieber-style account with 100M followers creates 100M ZADDs per post. That's 100MB of "member" strings plus 40MB of index overhead. It overwhelms a single primary and bottlenecks the worker pool.

### Trade-off summary

| Strategy | Write cost | Read cost | Memory | Good for |
|---|---|---|---|---|
| Fan-out on write | O(N followers) | O(log N) per user | N followers × feed_size | Normal users (<10k followers) |
| Fan-out on read | O(1) | O(followees × log N) | O(post × author) | Celebrity accounts |
| **Hybrid (us)** | O(N) for normals, O(1) for celebs | O(log N) + small merge | Bounded | Production social apps |

---

## 3. Real-time notifications

Two channels work together:

### Durable channel: `STREAM notif:stream:{user_id}`
- `XADD` on every event (~1ms).
- `MAXLEN ~ 1000` keeps per-user memory bounded (approximate trim, O(1)).
- Clients resume from their last-seen stream ID — no missed events on reconnect.

### Ephemeral channel: `PUBLISH notif:pub:{user_id}`
- Fire-and-forget JSON broadcast.
- Zero disk I/O → <1ms delivery to subscribed WebSockets.
- If no subscriber, message is dropped (durable copy lives in the Stream).

### WebSocket flow
1. Client opens `/notifications/ws?token=…`.
2. Server authenticates, sends last 20 notifications from the Stream (`XREVRANGE`).
3. Server SUBSCRIBES to the user's pub/sub channel and forwards every message.

### Why this pattern beats alternatives
| Approach | Missing events? | Latency | Complexity |
|---|---|---|---|
| Poll DB every 2s | No, but high DB load | 0–2s | Low |
| Pub/Sub only | **Yes** (offline) | <1ms | Low |
| Kafka + WS gateway | No | ~5–50ms | High |
| **Streams + Pub/Sub** | No | <1ms live, replay on reconnect | Moderate |

---

## 4. Rate limiting

### Sliding window (primary)
ZSET `rl:{bucket}:{identity}` where members are timestamps. Lua script atomically:
1. `ZREMRANGEBYSCORE` — drop events older than the window.
2. `ZCARD` — count remaining.
3. If under limit: `ZADD now, <uid>` + `PEXPIRE`.
4. Else: compute `retry-after`.

Single round-trip, zero races between processes.

### Token bucket (fallback for bursty APIs)
`HASH {tokens, last_refill_ts}`. Lua refills `(now − last) × rate / 1000` tokens, capped at capacity, then deducts `cost`. Also single round-trip.

### Trade-offs
- **Sliding window** is fair but uses O(max_events) memory per identity.
- **Token bucket** is O(1) memory and permits bursts, but is less precise.
- Both are *distributed* because Redis is the shared state. No need for sticky sessions at the load balancer.

---

## 5. Trending (ZSET with exponential decay)

```
score(post) = (likes + 1) × exp(−λ × age_hours)
```

- **Why `likes + 1`?** A brand-new 0-like post still enters with a non-zero score, so brand-new content has a chance to surface before losing its race against stale high-like posts.
- **Why exp-decay and not windowed counts?** Windowed counts (likes-in-last-hour) need N buckets per post × many posts. Exp-decay is a single float per post → `ZADD` is O(log N).
- **Why `prune_trending()` vs reliance on TTL?** `ZSET` doesn't support per-member TTL; we periodically run `ZREMRANGEBYSCORE ≤ threshold`.

A fresh post with 0 likes has score ≈ 1. After 48h at `λ=0.08`, its score ≈ `exp(−3.84) ≈ 0.021`. Anything below that is culled.

---

## 6. Distributed lock

`SET key <uuid> NX EX <ttl>` returns `OK` only to the first caller. To release, we `EVAL` a CAS-delete that only removes the key if the value matches our UUID token.

### Dangerous bug this prevents
```
T=0s   Process A acquires lock (ttl=5s)
T=6s   A's lock expired, B acquires
T=7s   A finishes, DELs the key — B loses its lock!
```

The CAS-delete means A's `DEL` is a no-op because the value no longer matches A's token.

### Not Redlock?
For this project we assume a single Redis primary. Redlock's 5-node voting is overkill; correctness + performance of single-node SETNX with CAS-delete is sufficient for the narrow critical sections we protect (counter folds, inventory-like operations).

---

## 7. Scaling strategy

### Horizontal scaling — app tier
- The FastAPI process is stateless (all state in Redis/Postgres). Run N replicas behind a load balancer.
- Workers (`fanout_worker`, `notification_worker`) also scale horizontally — the consumer group name stays `fanout-workers`, new instances join automatically.
- No sticky sessions required (sessions are in Redis).

### Horizontal scaling — Redis

#### Redis Cluster (sharding)
- Keys are hashed into 16384 slots, slots distributed across N primaries.
- **Critical:** keys that need to be operated on atomically (e.g. a pipelined `ZADD` + `ZREMRANGEBYRANK` to the same feed) must share a hash slot. Our keys already do — they're all built from the same user_id prefix (e.g. `feed:home:{uid}`).
- For cross-user operations (e.g. rate limit + feed) we avoid cross-slot transactions. `{tag}` keyspace tagging is used only where needed.

#### Read replicas
- Deploy Redis replicas and point read-only consumers (trending, leaderboard) at them.
- **Beware:** replication lag can show stale counters. Fine for trending/DAU, bad for rate limiting (always read from primary).

### Vertical scaling
- Start with a single Redis primary (1 core is saturated at ~100k ops/s), then shard.
- Separate processes with high fan-out latency into their own Redis instance: streams on `redis-jobs`, cache + feed on `redis-primary`.

---

## 8. Failure scenarios

### Redis crash
- **AOF `appendfsync everysec`** loses ≤1s of writes on ungraceful shutdown.
- **On startup**, AOF is replayed. Takes ~1s per 100k ops — tune `auto-aof-rewrite-*` to keep it small.
- **App-side**: Streams workers re-deliver un-ack'd messages via `XAUTOCLAIM` within ~60s.
- **Data rebuild**: `user_service._backfill_counters()` rehydrates counters from Postgres on first read-miss. Feeds rebuild lazily; if that's too slow, run `scripts/rebuild_feeds.py` (would be next addition).

### Cache miss storms
- `cache.get_or_set` uses a **single-flight lock** (`SETNX`-based) — only one process hits Postgres per hot key per expiry.
- Losing processes poll briefly (≤50ms total) then read the populated cache.
- TTLs are **jittered ±10%** so 10k related keys don't simultaneously expire.

### Worker crash mid-job
- Workers `XACK` only after successful processing — the message stays in the Pending Entry List (PEL) otherwise.
- Every worker runs a 30s reclaim loop: `XAUTOCLAIM min-idle=60s` picks up orphaned messages and re-processes.
- `XACK` is idempotent — even double-processing is safe because our jobs are idempotent (ZADD with same score is a no-op).

### Postgres unreachable
- Writes that must reach Postgres (create post, create user) fail fast with 5xx.
- Read-path for `/feed/home` still works from Redis — degraded but available.
- Counters and feeds keep working from Redis alone.

### Pub/Sub subscriber disconnects mid-event
- No message loss: the durable Stream copy is fetched on WebSocket reconnect via `XREVRANGE`.
- We could also track `last_stream_id` per client for precise resumption.

---

## 9. Consistency trade-offs

| Operation | Guarantee | Reason |
|---|---|---|
| `create_post` → visible in author's own feed | **Read-your-writes** | Same Redis pipeline |
| `create_post` → visible in a follower's feed | **Eventual**, ~20–200ms | Fan-out job queue |
| `like_post` → visible like count | **Read-your-writes** | Atomic INCR |
| `follow` → followed user appears in home feed | **Eventual**, <1s | Queued backfill |
| Session revoke → old token rejected | **Immediate** on primary | Hash deletion |
| Notification sent → live delivered | **Eventual** but bounded | Pub/Sub push + Stream backup |
| Trending score after like | **Eventual** | Recomputed on every like, drift during λ window |
| DAU (HyperLogLog) | ±1.6% error | Acceptable for analytics |

### Why eventual for feeds?
Users tolerate a ~1s delay between "my friend posted" and "it showed up in my feed". Strong consistency would require:
- Cross-user 2PC (very slow), or
- Per-read fan-in from N friends (doesn't scale past ~100 followees).

Neither fits the performance envelope of a modern social app. Eventual consistency via fan-out-on-write is the industry standard.

---

## 10. Memory & cost model

Assume 10M users, 100M posts, avg 200 followers, 1000-entry feed cap:

| Key | Per-unit size | Total |
|---|---|---|
| `feed:home:{uid}` ZSET | ~40KB (1000 × 40B) | 10M × 40KB ≈ 400GB |
| `feed:user:{uid}` ZSET | ~20KB (500 × 40B) | 10M × 20KB ≈ 200GB |
| `trending:posts` ZSET | 40B × ~50k recent | ~2MB |
| Post cache | ~1KB JSON | 1M hot posts × 1KB = 1GB |
| Session (HASH) | ~200B | 1M sessions × 200B = 200MB |
| Counters | ~20B | 100M posts × 20B × 2 = 4GB |

**Total hot working set ≈ 600GB.**

A single machine can't do it; this is where **Redis Cluster** with 6–12 shards enters. Each shard runs ~50GB. That's the scale where the "hybrid fan-out + periodic eviction" approach in this codebase truly earns its keep.

---

## 11. What's next (not included but natural extensions)

- **Counter fold-back cron**: sweep Redis counters into Postgres aggregates hourly.
- **RediSearch** for full-text on posts (drop in over `posts` index).
- **Redis Geo** for location-based feeds.
- **Bloom filter** for "did user X already see post Y?" in feed de-dup.
- **Prometheus exporter** wrapping the `/metrics` endpoint.
- **Alembic migrations** replacing `create_all`.
- **Chaos testing**: kill Redis / worker mid-job; verify `XAUTOCLAIM` recovery.
