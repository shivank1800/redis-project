# Real-Time Social Feed UI

React + TypeScript + Tailwind frontend for the existing Redis-backed FastAPI backend.

This is a learning project. The code intentionally explains how the UI maps to backend behavior such as Redis Sorted Set feeds, Redis Streams notifications, Pub/Sub live delivery, Redis sessions, and Redis rate limiting.

## Run Locally

Start the backend first:

```bash
cd ..
make up
```

Then start the frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

## Docker

The root `docker-compose.yml` includes a `frontend` service.

```bash
cd ..
docker compose up --build -d
```

Open:

- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs

## Environment

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

The browser calls the backend directly. In Docker, these values still use `localhost` because the JavaScript runs in your browser, not inside the container.

## Structure

```text
src/
  components/  reusable UI pieces
  pages/       route-level screens
  services/    API abstraction and error translation
  hooks/       reusable data/state logic
  store/       Zustand global state
  utils/       small helpers
  types/       API contracts
docs/
  architecture.md
```

## Key Features

- Login/signup with Redis-backed sessions.
- Feed page using cursor pagination and optimistic updates.
- Create post with optimistic insertion.
- Like/comment optimistic UI.
- Real-time notifications through WebSocket with polling fallback.
- Notification badge counter.
- Trending posts auto-refreshing from Redis Sorted Set rankings.
- 429 rate-limit banner for Redis distributed limiter responses.
- Profile page with optimistic follow/unfollow counters.
- Dark mode.
- Debounced recent activity search.

## Important Backend Contract Note

The current backend does not expose a `/users/{id}/posts` endpoint. The profile page documents this and explains how it would normally map to the backend's Redis `feed:user:{id}` timeline.
