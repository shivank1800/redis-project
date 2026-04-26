# Compose command: auto-detect, or override on the CLI, e.g.
#   make up DOCKER_COMPOSE='docker-compose'
.DEFAULT_GOAL := help

DOCKER_COMPOSE ?= $(shell \
	if docker compose version >/dev/null 2>&1; then echo "docker compose"; \
	elif command -v docker-compose >/dev/null 2>&1; then echo docker-compose; \
	else echo "docker compose"; fi)

.PHONY: help up down logs ps build clean test infra-only check-docker

help:
	@echo "Redis Social Feed — Docker helpers"
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
	@echo "Using: $(DOCKER_COMPOSE)"
	@echo "See DOCKER.md if something fails (daemon, compose plugin, ports)."

up: check-docker
	$(DOCKER_COMPOSE) up --build -d

down: check-docker
	$(DOCKER_COMPOSE) down

logs: check-docker
	$(DOCKER_COMPOSE) logs -f api

ps: check-docker
	$(DOCKER_COMPOSE) ps -a

build: check-docker
	$(DOCKER_COMPOSE) build

infra-only: check-docker
	$(DOCKER_COMPOSE) up -d redis postgres

clean: check-docker
	$(DOCKER_COMPOSE) down -v

test:
	.venv/bin/pytest tests -q || pytest tests -q

check-docker:
	@docker info >/dev/null 2>&1 || ( \
	  echo ""; \
	  echo "Docker daemon is not running."; \
	  echo "  macOS/Windows: start Docker Desktop and wait until the engine is ready."; \
	  echo "  Linux: sudo systemctl start docker"; \
	  echo ""; exit 1)
	@$(DOCKER_COMPOSE) version >/dev/null 2>&1 || ( \
	  echo ""; \
	  echo "Docker Compose not found."; \
	  echo "  Install Docker Desktop (includes: docker compose), OR"; \
	  echo "  brew install docker-compose"; \
	  echo "  Then run: make up DOCKER_COMPOSE=docker-compose"; \
	  echo ""; exit 1)
