# Docker: get the stack running

## 1. Docker must be running

**macOS / Windows:** open **Docker Desktop** and wait until it says **Docker Engine is running** (whale icon steady, not animating).

**Linux:**

```bash
sudo systemctl start docker
sudo usermod -aG docker "$USER"   # then log out and back in
```

**Quick check:**

```bash
docker info
```

If you see `Cannot connect to the Docker daemon` or `no such file or directory` for `docker.sock`, the daemon is not running — fix that before anything else.

---

## 2. Use Compose V2 or V1

**Preferred (Docker Desktop, modern CLI):**

```bash
docker compose version
```

**If you get `unknown command: docker compose`**, install the Compose plugin or the standalone binary:

- **macOS (Homebrew):** `brew install docker-compose`  
  Then use **`docker-compose`** instead of **`docker compose`** everywhere, or run:

  ```bash
  make DC='docker-compose' up
  ```

- **Linux:** follow [Install Docker Compose](https://docs.docker.com/compose/install/).

This repo’s **Makefile** picks `docker compose` when it works, otherwise `docker-compose`.

---

## 3. Start everything

From the project root:

```bash
make up
```

Or manually:

```bash
docker compose up --build -d
# or
docker-compose up --build -d
```

You do **not** need a `.env` file for Docker anymore — defaults are in `docker-compose.yml`.

- API: http://localhost:8000/docs  
- Frontend: http://localhost:5173  
- Health: http://localhost:8000/health  

**Logs:**

```bash
make logs
# or
docker compose logs -f api
```

**Stop:**

```bash
make down
```

---

## 4. Only Redis + Postgres (no API build)

If the API image fails to build (network, proxy, etc.) but you only need databases:

```bash
make infra-only
```

Then run the API on the host:

```bash
export POSTGRES_HOST=127.0.0.1 REDIS_HOST=127.0.0.1
python -m uvicorn app.main:app --reload --port 8000
```

---

## 5. Common errors

### `port is already allocated` (5432, 6379, 8000)

Something else is using that port. Either stop it or change the left side in `docker-compose.yml`:

```yaml
ports:
  - "5433:5432"   # host:container
```

### `failed to solve: process "/bin/sh -c apt-get update" did not complete`

Usually **no network** from Docker (VPN, corporate proxy, or airplane mode). Retry with network on; on VPN, try “Docker Desktop → Settings → Resources → Network” or disable VPN for the build.

### `exec format error` (ARM Mac building for wrong arch)

Rare. Try explicit platform in `Dockerfile` first line:

```dockerfile
FROM --platform=linux/amd64 python:3.12-slim
```

(Only if you hit arch errors.)

### Compose file `required: false` for `env_file`

If your Compose is very old and you re-enable `env_file` in `docker-compose.yml`, upgrade Docker Desktop / Compose to 2.24+, or remove the `env_file` block (defaults are already in `environment:`).

---

## 6. Verify after `make up`

```bash
docker compose ps
curl -s http://localhost:8000/health | head
```

You should see `"status": "ok"` and Redis `pong` true.
