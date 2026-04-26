# Frontend Architecture

## Goal

The frontend is intentionally simple but production-shaped. It teaches how a browser application should interact with a Redis-heavy backend without ever talking to Redis directly.

The frontend talks to:

- HTTP APIs for auth, feed, trending, profile, notifications, and search.
- WebSocket API for live notification delivery.

The backend talks to Redis for:

- Sorted Set feeds and trending.
- Streams and Pub/Sub notifications.
- Session storage.
- Distributed rate limiting.
- Cached profile/post data.

## A. How the Frontend Interacts With the Backend

```text
Browser
  |
  | HTTP + Bearer token
  v
FastAPI backend
  |
  | Redis sessions / rate limits / feed / trending / notifications
  v
Redis
```

The browser stores only an opaque token in `localStorage`. The backend validates that token against Redis session data. If Redis expires or revokes the session, the next request returns 401 and the frontend clears local auth state.

### API Layer

All HTTP calls go through `src/services/api.ts`.

Why this matters:

- Token injection is centralized.
- 401 handling is consistent.
- Redis rate-limit responses (`429`) become friendly UI messages.
- Components stay focused on rendering.

### State Split

Global state:

- Auth user/token (`authStore`), because every route and API call depends on it.
- Dark mode and rate-limit banner (`uiStore`), because they are cross-page concerns.

Local/hook state:

- Feed posts live in `useFeed()` because only the feed page owns pagination and optimistic post updates.
- Trending lives in `useTrending()` because it is cheap to refresh from Redis and does not need global ownership.
- Profile details live in `useProfile()` because they depend on the route parameter.

## B. How Redis Affects Frontend Behavior

### Why the Feed Is Fast

Backend behavior:

```text
POST /posts
  -> Postgres row
  -> Redis ZADD feed:user:{author_id}
  -> Redis Stream job jobs:fanout
  -> worker ZADD feed:home:{follower_id}

GET /feed/home
  -> Redis ZREVRANGEBYSCORE feed:home:{user_id}
  -> hydrate post details
```

Frontend behavior:

- Uses cursor pagination with `before_ts`, matching Redis Sorted Set scores.
- Optimistically inserts a newly created post because the author's own Redis timeline updates immediately.
- Uses "Load older posts" instead of database offset pagination.

```text
FeedPage
  -> useFeed()
    -> api.getHomeFeed({ beforeTs })
      -> GET /feed/home?before_ts=...
```

### Why Notifications Are Real-Time

Backend behavior:

```text
like/comment/follow
  -> XADD notif:stream:{recipient_id}
  -> PUBLISH notif:pub:{recipient_id}
  -> XADD jobs:notifications for persistence worker
```

Frontend behavior:

- Opens WebSocket `/notifications/ws?token=...`.
- Receives initial history from Redis Stream.
- Receives live events from Redis Pub/Sub.
- Falls back to polling `/notifications` if WebSocket fails.

```text
useNotifications()
  -> WebSocket live path
  -> REST polling fallback
  -> Notification badge updates globally
```

### Why Caching Matters

The backend caches profiles and posts in Redis with TTLs. The frontend does not need to implement aggressive persistent caching because the server already returns hot data quickly.

Frontend local caching is intentionally light:

- Existing feed posts remain in memory while the page is mounted.
- Trending refreshes every few seconds instead of being cached forever.
- Auth user is stored locally only to avoid a blank navbar on refresh; backend Redis session remains authoritative.

## C. Data Flow Diagrams

### Login

```text
LoginPage
  -> useAuth.login()
    -> POST /auth/login
      -> backend creates Redis HASH session:{token}
      -> frontend stores token locally
```

### Feed Read

```text
FeedPage
  -> useFeed.loadInitial()
    -> GET /feed/home
      -> backend reads Redis ZSET feed:home:{user_id}
      -> backend hydrates post payloads
      -> UI renders PostCard list
```

### Create Post With Optimistic UI

```text
CreatePostBox
  -> useFeed.createPost(content)
    -> insert temporary post in UI
    -> POST /posts
      -> backend inserts Postgres row
      -> backend ZADD own Redis timeline
      -> backend XADD fanout job
    -> replace temporary post with saved response
```

If the request fails:

```text
temporary post removed
error banner/message shown
```

### Notification Live Delivery

```text
Redis Pub/Sub
  -> backend WebSocket
    -> useNotifications.onmessage
      -> prepend event
      -> increment badge
```

Fallback:

```text
WebSocket blocked/dropped
  -> set connectionState = polling
  -> GET /notifications every 8s
```

### Rate Limit Handling

```text
User clicks too fast
  -> backend Redis Lua sliding-window limiter rejects
  -> HTTP 429 Retry-After
  -> api.ts throws ApiError("rate_limited")
  -> global RateLimitBanner shown
```

## Production Notes

- The app uses localStorage for simplicity. A production app might prefer httpOnly cookies to reduce XSS token theft risk.
- WebSocket reconnect logic is deliberately small. Production systems normally use exponential backoff and visibility-aware reconnects.
- The profile page documents a missing backend endpoint (`/users/{id}/posts`) instead of faking data. This keeps the frontend honest about API contracts.
- Because Redis makes feed/trending reads cheap, the frontend favors refresh and optimistic UI over complex client-side caching.
