# OpenAdeia — Makefile
# Usage: make <target>
# Run `make help` for all targets.

.PHONY: help dev build up down logs migrate seed reset \
        install install-backend install-frontend \
        lint lint-backend lint-frontend \
        release deploy ssh

SHELL := /bin/bash
APP    := openadeia
SERVER ?= $(SSH_HOST)
USER   ?= $(SSH_USER)

# ── Colors ──────────────────────────────────────────────────────────
GREEN  := \033[0;32m
YELLOW := \033[1;33m
CYAN   := \033[0;36m
RESET  := \033[0m

help: ## Show this help message
	@echo ""
	@echo "  $(CYAN)OpenAdeia — Available commands$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ── Local development ────────────────────────────────────────────────
dev-infra: ## Start infrastructure (DB, Redis, MinIO) for local dev
	docker compose -f docker-compose.dev.yml up -d
	@echo "$(GREEN)✓ Infrastructure ready$(RESET)"
	@echo "  MinIO Console → http://localhost:9001  (minioadmin / minioadmin)"
	@echo "  PostgreSQL    → localhost:5432 (eadeies / eadeies)"

dev-backend: ## Start backend dev server (hot reload)
	cd backend && node --watch src/index.js

dev-frontend: ## Start frontend dev server
	cd frontend && npm run dev

dev: dev-infra ## Start full dev environment in parallel
	@echo "$(YELLOW)Starting backend + frontend in parallel…$(RESET)"
	@$(MAKE) dev-backend & $(MAKE) dev-frontend

# ── Install ──────────────────────────────────────────────────────────
install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install backend dependencies
	cd backend && npm install

install-frontend: ## Install frontend dependencies
	cd frontend && npm install

# ── Lint ─────────────────────────────────────────────────────────────
lint: lint-backend lint-frontend ## Lint all

lint-backend: ## Lint backend
	cd backend && npm run lint --if-present

lint-frontend: ## Lint frontend
	cd frontend && npm run lint --if-present

# ── Database ─────────────────────────────────────────────────────────
migrate: ## Run pending DB migrations
	cd backend && npm run migrate

migrate-rollback: ## Rollback last migration
	cd backend && npm run migrate:rollback

seed: ## Run DB seeds
	cd backend && npm run seed

reset: ## Drop + recreate DB (migrate + seed) — DESTRUCTIVE
	@echo "$(YELLOW)⚠ This will reset the database. Continue? [y/N]$(RESET)" && read ans && [ "$$ans" = "y" ]
	cd backend && npm run migrate:rollback && npm run migrate && npm run seed
	@echo "$(GREEN)✓ Database reset complete$(RESET)"

# ── Docker (full stack) ───────────────────────────────────────────────
build: ## Build all Docker images
	docker compose build

up: ## Start all services (Docker Compose)
	docker compose up -d
	@echo "$(GREEN)✓ All services started$(RESET)"
	@echo "  Frontend      → http://localhost:3000"
	@echo "  API           → http://localhost:4000"
	@echo "  MinIO Console → http://localhost:9001"
	@echo "  Keycloak      → http://localhost:8080"
	@echo "  Meilisearch   → http://localhost:7700"

down: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose restart

logs: ## Tail all service logs
	docker compose logs -f

logs-api: ## Tail API logs
	docker compose logs -f api

logs-frontend: ## Tail frontend logs
	docker compose logs -f frontend

ps: ## Show running containers
	docker compose ps

# ── Release ───────────────────────────────────────────────────────────
release: ## Tag and push a new release (use: make release TAG=v1.2.3)
ifndef TAG
	$(error TAG is required. Usage: make release TAG=v1.2.3)
endif
	@echo "$(CYAN)Releasing $(TAG)…$(RESET)"
	git tag -a $(TAG) -m "Release $(TAG)"
	git push origin main
	git push origin $(TAG)
	@echo "$(GREEN)✓ Tag $(TAG) pushed — GitHub Actions will build & deploy$(RESET)"

# ── Deploy (SSH) ──────────────────────────────────────────────────────
deploy: ## Deploy latest images to server (use: make deploy SERVER=user@host)
ifndef SERVER
	$(error SERVER is required. Usage: make deploy SERVER=user@host  or  SSH_HOST=host SSH_USER=user make deploy)
endif
	@echo "$(CYAN)Deploying to $(SERVER)…$(RESET)"
	./scripts/deploy.sh $(SERVER)

ssh: ## SSH into the server (use: make ssh SERVER=user@host)
ifndef SERVER
	$(error SERVER is required. Usage: make ssh SERVER=user@host)
endif
	ssh $(SERVER) -t "cd /opt/openadeia && bash"

# ── Server first-time setup ───────────────────────────────────────────
setup-server: ## First-time server setup (use: make setup-server SERVER=user@host)
ifndef SERVER
	$(error SERVER is required. Usage: make setup-server SERVER=user@host)
endif
	@echo "$(CYAN)Setting up server $(SERVER)…$(RESET)"
	ssh $(SERVER) 'bash -s' < scripts/setup-server.sh

# ── Utilities ─────────────────────────────────────────────────────────
backup-db: ## Backup production DB (use: make backup-db SERVER=user@host)
ifndef SERVER
	$(error SERVER is required)
endif
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S) && \
	  ssh $(SERVER) "docker compose -f /opt/openadeia/docker-compose.yml exec -T db \
	    pg_dump -U eadeies eadeies | gzip" > backups/db_$$TIMESTAMP.sql.gz && \
	  echo "$(GREEN)✓ Backup saved to backups/db_$$TIMESTAMP.sql.gz$(RESET)"

generate-xml: ## Generate TEE XML for a project (use: make generate-xml ID=<project-uuid>)
ifndef ID
	$(error ID is required. Usage: make generate-xml ID=<project-uuid>)
endif
	curl -s http://localhost:4000/api/projects/$(ID)/xml | xmllint --format -
