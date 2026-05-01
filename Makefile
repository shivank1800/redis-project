# Container engine helper.
#
# Picks a compose frontend only when a *working* engine is available:
#   1. podman compose   — needs `podman info` + a working compose *provider*
#       (on macOS Homebrew Podman this is usually the `docker-compose` binary:
#        `brew install docker-compose`)
#   2. .venv/bin/podman-compose — if you `pip install podman-compose` into .venv
#   3. podman-compose   — on PATH (same pip install, venv activated elsewhere)
#   4. docker compose   — Docker daemon + Compose v2 plugin
#   5. docker-compose   — Docker daemon + v1 binary on PATH
#
# `podman compose version` can fail even when `podman machine start` succeeded,
# because Podman shells out to docker-compose / podman-compose / Docker plugin.
#
# Override explicitly, e.g.
#   make up COMPOSE='docker compose'
#   make up COMPOSE=docker-compose

.DEFAULT_GOAL := help

# Homebrew + common paths (GUI/IDE make often has a minimal PATH on macOS)
export PATH := /opt/homebrew/bin:/usr/local/bin:$(HOME)/.local/bin:$(PATH)

# Resolve compose once; recipes inherit exported PATH above.
COMPOSE ?= $(shell \
	if podman info >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then echo "podman compose"; \
	elif podman info >/dev/null 2>&1 && [ -x .venv/bin/podman-compose ]; then echo .venv/bin/podman-compose; \
	elif podman info >/dev/null 2>&1 && command -v podman-compose >/dev/null 2>&1; then command -v podman-compose; \
	elif docker info >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then echo "docker compose"; \
	elif docker info >/dev/null 2>&1 && command -v docker-compose >/dev/null 2>&1; then echo docker-compose; \
	else echo ""; fi)

.PHONY: help up down logs ps build clean test infra-only check-engine

help:
	@echo "Redis Social Feed — container helpers (Podman or Docker)"
	@echo ""
	@echo "  make up           Build and start all services (detached)"
	@echo "  make down         Stop containers"
	@echo "  make logs         Follow API logs"
	@echo "  make ps           Container status"
	@echo "  make build        Build images only"
	@echo "  make infra-only   Only Redis + Postgres (no API image)"
	@echo "  make clean        Stop and remove volumes"
	@echo "  make test         Run pytest (needs .venv)"
	@echo ""
	@if [ -n "$(strip $(COMPOSE))" ]; then echo "Detected compose: $(COMPOSE)"; else echo "Detected compose: (none — see PODMAN.md §2)"; fi
	@echo "Override: make up COMPOSE='docker compose'"
	@echo "See PODMAN.md / DOCKER.md if something fails."

up: check-engine
	$(COMPOSE) up --build -d

down: check-engine
	$(COMPOSE) down

logs: check-engine
	$(COMPOSE) logs -f api

ps: check-engine
	$(COMPOSE) ps -a

build: check-engine
	$(COMPOSE) build

infra-only: check-engine
	$(COMPOSE) up -d redis postgres

clean: check-engine
	$(COMPOSE) down -v

test:
	.venv/bin/pytest tests -q || pytest tests -q

check-engine:
	@if [ -z "$(strip $(COMPOSE))" ]; then \
	  echo ""; \
	  echo "No working container engine + Compose pair was detected."; \
	  if podman info >/dev/null 2>&1; then \
	    echo ""; \
	    echo "Podman is running, but \`podman compose\` has no provider (see \`podman compose version\`)."; \
	    echo "  macOS — install the binary Podman looks for:"; \
	    echo "    brew install docker-compose"; \
	    echo "    make up"; \
	    echo ""; \
	    echo "  Or use the Python wrapper in this repo's venv:"; \
	    echo "    .venv/bin/pip install podman-compose"; \
	    echo "    make up"; \
	    echo ""; \
	  fi; \
	  echo "  Podman VM:"; \
	  echo "    podman machine start"; \
	  echo ""; \
	  echo "  Docker Desktop:"; \
	  echo "    Start Docker Desktop, then: make up"; \
	  echo ""; \
	  echo "  Docker without Compose v2 plugin:"; \
	  echo "    brew install docker-compose"; \
	  echo "    make up COMPOSE=docker-compose"; \
	  echo ""; exit 1; \
	fi
	@if echo '$(COMPOSE)' | grep -qE '^podman |podman-compose'; then \
	  podman info >/dev/null 2>&1 || ( \
	    echo ""; \
	    echo "Podman is not reachable (compose is set to: $(COMPOSE))."; \
	    echo "  macOS/Windows: podman machine start"; \
	    echo "  (first time:     podman machine init)"; \
	    echo ""; \
	    echo "If you use Docker instead: make up COMPOSE='docker compose'"; \
	    echo ""; exit 1); \
	else \
	  docker info >/dev/null 2>&1 || ( \
	    echo ""; \
	    echo "Docker daemon is not running (compose is set to: $(COMPOSE))."; \
	    echo "  macOS/Windows: start Docker Desktop"; \
	    echo "  Linux:         sudo systemctl start docker"; \
	    echo ""; exit 1); \
	fi
	@$(COMPOSE) version >/dev/null 2>&1 || ( \
	  echo ""; \
	  echo "Compose command failed: $(COMPOSE)"; \
	  echo "  Try: docker compose version   OR   docker-compose version"; \
	  echo ""; exit 1)
