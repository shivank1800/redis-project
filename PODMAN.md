# Podman: get the stack running

This project runs on either **Podman** (preferred, rootless, daemonless) or
Docker. The same `docker-compose.yml` is used for both — Podman reads standard
Compose files natively.

---

## 1. Install Podman

**macOS:**

Do **not** paste `podman machine …` on the same line as `brew install` — Homebrew
will treat the extra words as formula names and error out.

```bash
brew install podman docker-compose
```

```bash
podman machine init --cpus 2 --memory 4096
podman machine start
```

`docker-compose` is **not** optional on macOS if you use **`podman compose`**:
Homebrew Podman implements `podman compose` by shelling out to a *compose
provider* (`docker-compose`, Docker’s CLI plugin, or `podman-compose`). If none
are installed, `podman compose version` fails with *“looking up compose provider
failed”* and **`make up`** will not detect a working stack.

**Linux (Fedora / RHEL):**

```bash
sudo dnf install -y podman podman-compose
systemctl --user enable --now podman.socket
```

**Linux (Debian / Ubuntu 22.04+):**

```bash
sudo apt install -y podman podman-compose
```

**Windows:**

Install [Podman Desktop](https://podman-desktop.io/) and run `podman machine init && podman machine start` in PowerShell.

**Quick check:**

```bash
podman info
```

If **`podman info`** fails, the Linux VM is not running — run
**`podman machine start`** before **`make up`**.

If **`podman info`** works but **`podman compose version`** prints errors about a
*compose provider*, install one of the options in **§2** (most Mac users use
**`brew install docker-compose`**).

---

## 2. Install a Compose *provider* (required for `podman compose` on Mac)

Podman’s **`podman compose`** subcommand does not embed Compose — it looks for
one of these on your machine:

| Provider | Typical install |
|----------|-----------------|
| **`docker-compose`** (v1 binary) | **`brew install docker-compose`** (recommended on macOS + Podman) |
| Docker Compose **v2 CLI plugin** | Docker Desktop, or [Compose plugin install](https://docs.docker.com/compose/install/) |
| **`podman-compose`** | **`pip install podman-compose`** (then ensure `podman-compose` is on `PATH`, or install into **`.venv`** — the `Makefile` runs **`.venv/bin/podman-compose`** if that file exists) |

Check:

```bash
podman compose version
```

You should see a **Docker Compose** or **podman-compose** version line, not a
“provider” / “executable file not found” error.

The repo **`Makefile`** picks, in order: **`podman compose`** (with a working
provider) → **`.venv/bin/podman-compose`** → **`podman-compose`** on `PATH` →
**`docker compose`** → **`docker-compose`** against Docker.

---

## 3. Start everything

From the project root:

```bash
make up
```

Or manually:

```bash
podman compose up --build -d
# or, if you installed the Python wrapper:
podman-compose up --build -d
```

You do **not** need a `.env` file — defaults live in `docker-compose.yml`.

- Frontend:  http://localhost:5173
- REST docs: http://localhost:8000/docs
- Health:    http://localhost:8000/health

**Logs:**

```bash
make logs
# or
podman compose logs -f api
```

**Stop:**

```bash
make down
```

---

## 4. Only Redis + Postgres (no API build)

If the API image fails to build (network, proxy, etc.) but you only need the
data plane:

```bash
make infra-only
```

Then run the API on the host:

```bash
export POSTGRES_HOST=127.0.0.1 REDIS_HOST=127.0.0.1
python -m uvicorn app.main:app --reload --port 8000
```

---

## 5. Common Podman gotchas

### `Error: short-name "postgres:16-alpine" did not resolve`

Podman is strict about image registries by default. Either:

- Pull with the full path: `podman pull docker.io/library/postgres:16-alpine`, or
- Add `unqualified-search-registries = ["docker.io"]` to
  `~/.config/containers/registries.conf` (macOS/Linux) or the equivalent
  `%APPDATA%\containers\registries.conf` on Windows.

### Ports under 1024 don't bind (rootless)

Rootless Podman can't bind privileged ports. All ports in this project are
≥5173, so you're fine — but if you change `docker-compose.yml` to bind
port 80, run as root or use `sysctl net.ipv4.ip_unprivileged_port_start=0`.

### `permission denied` on volumes

SELinux on Fedora/RHEL relabels volume mounts. The compose file uses named
volumes (`redis_data`, `postgres_data`), which Podman manages itself — no
host labels required. If you add a bind mount later, append `:Z` to the
volume spec.

### `podman machine` on macOS / Windows can't reach `localhost`

If `curl localhost:8000` fails from the host, check:

```bash
podman machine inspect | grep -i port
```

The VM forwards listed ports to the host automatically when declared in
`docker-compose.yml`. If that's not happening, try
`podman machine stop && podman machine start`.

### `container_name` conflicts after `podman machine` restart

Podman may keep old containers between machine restarts. Clean up with:

```bash
podman rm -f feed-redis feed-postgres feed-api feed-worker-fanout feed-worker-notifications feed-frontend
```

---

## 6. Verify after `make up`

```bash
podman compose ps
curl -s http://localhost:8000/health | head
```

You should see `"status": "ok"` and Redis `pong` true.

---

## Prefer Docker?

Everything above works with `docker` / `docker compose` — the Makefile
auto-detects the available engine. See [DOCKER.md](./DOCKER.md) for
Docker-specific troubleshooting.
