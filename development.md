# OpenAdeia — Development Guide

## Prerequisites

- Node.js 20 LTS
- Docker & Docker Compose
- Git

## Local Development Setup

### 1. Clone & Install

```bash
git clone https://github.com/ppapadeas/openadeia.git
cd openadeia
cp .env.example .env
# Edit .env — set SMTP credentials, JWT_SECRET
```

### 2. Start Infrastructure

```bash
# Starts PostgreSQL (port 5433) + MinIO (ports 9000/9001)
docker compose -f docker-compose.dev.yml up -d
```

### 3. Backend

```bash
cd backend
npm install
npm run migrate    # Create tables
npm run seed       # Sample data (if available)
npm run dev        # http://localhost:4000 (hot reload via --watch)
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000 (Vite HMR)
```

### 5. Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000 |
| MinIO Console | http://localhost:9001 (minioadmin/minioadmin) |
| Health Check | http://localhost:4000/health |

---

## Full Stack (Docker Compose)

```bash
docker compose up -d
docker compose exec api npm run migrate
docker compose exec api npm run seed
# Open http://localhost:3000
```

All 7 services: frontend, api, db (PostgreSQL), redis, minio, keycloak, meilisearch.

---

## Project Structure

```
openadeia/
├── backend/
│   ├── src/
│   │   ├── index.js              # Entry point (auto-migrate on start)
│   │   ├── app.js                # Fastify app builder
│   │   ├── routes/               # REST API endpoints
│   │   │   ├── projects.js       # CRUD + workflow
│   │   │   ├── documents.js      # Upload/download
│   │   │   ├── tee.js            # TEE sync/import
│   │   │   ├── fees.js           # Fee calculator
│   │   │   ├── portal.js         # Client portal
│   │   │   ├── nok.js            # Rules engine
│   │   │   ├── auth.js           # JWT login/register
│   │   │   ├── clients.js        # Client CRUD
│   │   │   ├── email.js          # Send/list emails
│   │   │   ├── studies.js        # Engineering studies
│   │   │   ├── search.js         # Full-text search
│   │   │   └── sign.js           # Digital signatures
│   │   ├── services/             # Business logic
│   │   │   ├── tee-client.js     # Playwright TEE scraper
│   │   │   ├── fee-calculator.js # ΠΔ 696/74 formula
│   │   │   ├── workflow-engine.js # State machine
│   │   │   ├── portal-*.js       # Portal services
│   │   │   └── job-store.js      # In-memory job tracking
│   │   ├── utils/
│   │   │   └── xml-generator.js  # TEE XSD XML builder
│   │   ├── config/               # DB, Redis, MinIO, Email
│   │   ├── middleware/           # Zod validation
│   │   ├── plugins/              # Sentry error monitor
│   │   └── jobs/                 # BullMQ workers
│   ├── migrations/               # Knex migrations (001-006)
│   ├── config/
│   │   └── nok-rules.json        # Declarative permit rules
│   ├── scripts/                  # ADF discovery tools
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Routes + auth guard
│   │   ├── components/           # By domain (projects, fees, portal, etc.)
│   │   ├── pages/                # Full page views
│   │   ├── api/                  # Axios wrappers
│   │   ├── store/                # Zustand state
│   │   └── utils/                # Enums, constants
│   ├── nginx.conf                # Production Nginx config
│   ├── vite.config.js
│   └── Dockerfile
├── xsd/                          # TEE XSD schemas
├── scripts/                      # Deployment automation
│   ├── deploy.sh                 # SSH deploy script
│   ├── setup-server.sh           # First-time server setup
│   └── nginx-site.conf           # Nginx reverse proxy
├── docker-compose.yml            # Full stack
├── docker-compose.dev.yml        # Dev (infra only)
├── docker-compose.prod.yml       # Production overrides
└── Makefile                      # Dev & deploy targets
```

---

## Database

### Migrations

```bash
cd backend
npm run migrate          # Run pending migrations
npm run migrate:rollback # Rollback last batch
```

Migrations are in `backend/migrations/` and auto-run on backend startup in production.

### Schema Overview

**Core:** users, clients, projects, properties, ekdosi, documents, approvals, doc_rights, prev_praxis, workflow_logs, emails

**Fees:** fee_lambda, fee_calculations

**Portal:** portal_projects, portal_steps, portal_form_data, portal_files, portal_templates, portal_generated_docs

### Extensions
- `uuid-ossp` — UUID generation
- `postgis` — Spatial data (property coordinates)

---

## Testing

```bash
# Backend
cd backend && npm test
cd backend && npm run test:watch

# Frontend
cd frontend && npm test
cd frontend && npm run test:watch
```

Testing stack: Vitest + React Testing Library + jsdom.

---

## API Quick Reference

### Auth
```
POST   /api/auth/login           # → { token }
POST   /api/auth/register        # → { user }
GET    /api/auth/me              # → { user }
```

### Projects
```
GET    /api/projects              # ?stage=&type=&q=&page=&limit=
POST   /api/projects              # { type, title, client_id }
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id          # Soft delete
POST   /api/projects/:id/advance  # Workflow transition
GET    /api/projects/:id/xml      # TEE XML export
```

### TEE
```
GET    /api/tee/status            # TEE credentials configured?
POST   /api/tee/sync              # → 202 { jobId }
GET    /api/tee/sync/:jobId       # Poll job status
GET    /api/tee/applications      # List scraped apps
POST   /api/tee/import/:teeCode   # Import as project
```

### Fees
```
POST   /api/fees/calculate        # Stateless (no auth needed)
GET    /api/fees/lambda/current   # Current λ value
```

### Portal
```
GET    /api/portal/projects/:token   # Public (token-based)
POST   /api/portal/steps/:id/submit
```

---

## Deployment

### Production (Home Server → openadeia.org)

Deployment is automated via GitHub Actions on push to `main`:

1. **Test** — Lint + Vitest (backend + frontend)
2. **Build** — Docker images (backend, frontend)
3. **Push** — ghcr.io/ppapadeas/openadeia-{backend,frontend}:latest
4. **Deploy** — SSH to server → pull images → rolling restart → migrate

### Manual Deploy

```bash
# From local machine
./scripts/deploy.sh user@server
# or
make deploy SERVER=user@server
```

### First-Time Server Setup

```bash
./scripts/setup-server.sh
# Installs Docker, Nginx, Certbot, UFW firewall
# Creates /opt/openadeia
```

### Server Stack
- Nginx reverse proxy (ports 80/443 → Docker containers)
- Let's Encrypt SSL (auto-renewed via Certbot)
- Docker Compose (docker-compose.yml + docker-compose.prod.yml)
- PostgreSQL data persisted in Docker volumes

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection (BullMQ, caching) |
| `JWT_SECRET` | JWT signing key |
| `MINIO_*` | MinIO S3 credentials |
| `SMTP_*` | Outgoing email (Gmail SMTP) |
| `SENTRY_DSN` | Error tracking |
| `VITE_API_URL` | Frontend → API URL |

---

## Makefile Targets

```bash
make dev          # Start dev environment
make test         # Run all tests
make build        # Build Docker images
make deploy       # Deploy to production
make backup-db    # Backup PostgreSQL
make logs         # View container logs
```
