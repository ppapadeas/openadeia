# OpenAdeia — Claude Code Guidelines

## Project Overview
Open-source web app for automating Greek building permits (οικοδομικές άδειες) via TEE e-Adeies.
License: AGPL-3.0 | Domain: openadeia.org

## Tech Stack
- **Frontend:** React 18 + Vite + Tailwind CSS + Zustand + TanStack Query
- **Backend:** Node.js 20 + Fastify 4 + Knex.js (PostgreSQL 16 + PostGIS)
- **Queue:** BullMQ + Redis 7
- **Storage:** MinIO (S3-compatible, self-hosted)
- **Auth:** JWT (@fastify/jwt) — Keycloak prepared but not active
- **Browser Automation:** Playwright Core (TEE scraping)
- **CI/CD:** GitHub Actions → ghcr.io → SSH deploy to home server

## Code Conventions
- UI text in Greek, code/comments in English
- ESLint for both frontend and backend
- Zod for API input validation
- Knex migrations for schema changes (sequential numbering: 001_, 002_, ...)
- Routes in `backend/src/routes/`, services in `backend/src/services/`
- React components organized by domain: `frontend/src/components/{domain}/`

## Key Commands
```bash
# Development
docker compose -f docker-compose.dev.yml up -d   # Start infra (DB, MinIO)
cd backend && npm run dev                          # Backend on :4000
cd frontend && npm run dev                         # Frontend on :3000

# Tests
cd backend && npm test
cd frontend && npm test

# Migrations
cd backend && npm run migrate

# Full stack (Docker)
docker compose up -d
```

## Architecture Notes
- TEE e-Adeies has NO public API — integration via Playwright scraping + XML generation
- XML must conform to AdeiaAitisiInput.xsd v2.9.1 (15 mandatory EKDOSI_DD rows)
- Fee calculator follows ΠΔ 696/74 formula: β = κ + μ/∛(Σ/1000λ)
- Async TEE sync returns 202 + jobId to avoid proxy timeouts
- Auto-migrations run on backend startup (index.js)

## Deployment
- Production runs on home server (self-hosted), exposed via openadeia.org
- Docker Compose with 7 services: frontend, api, db, redis, minio, keycloak, meilisearch
- GitHub Actions: test → build Docker images → push to ghcr.io → SSH deploy
- Nginx reverse proxy with Let's Encrypt SSL on host
- Deploy path on server: /opt/openadeia

## Database
- PostgreSQL 16 with PostGIS and uuid-ossp extensions
- 6 migration files covering: core schema, auth, TEE sync, TEE submission, fees, portal
- Key tables: users, clients, projects, properties, ekdosi, documents, approvals, workflow_logs, emails, fee_calculations, portal_*

## Important Files
- `backend/config/nok-rules.json` — Declarative permit rules (9 types)
- `xsd/AdeiaAitisiInput.xsd` — TEE XML schema (v2.9.1)
- `backend/src/services/tee-client.js` — Playwright TEE scraper
- `backend/src/services/fee-calculator.js` — Engineer fee calculator
- `backend/src/utils/xml-generator.js` — TEE XML builder
- `.github/workflows/ci-cd.yml` — CI/CD pipeline
