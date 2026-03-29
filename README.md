# OpenAdeia

**Open-source platform for automating Greek building permits via TEE e-Adeies.**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![CI/CD](https://github.com/ppapadeas/openadeia/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/ppapadeas/openadeia/actions/workflows/ci-cd.yml)
[![Latest Release](https://img.shields.io/github/v/release/ppapadeas/openadeia)](https://github.com/ppapadeas/openadeia/releases)
[![Website](https://img.shields.io/badge/Web-openadeia.org-green)](https://openadeia.org)

---

## Table of Contents

- [The Problem](#the-problem)
- [Preview](#preview)
- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Testing](#testing)
- [API Overview](#api-overview)
- [SaaS Plans](#saas-plans)
- [Deployment](#deployment)
- [Workflow](#workflow)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [Links](#links)

---

## The Problem

Greek engineers and architects spend weeks navigating the TEE e-Adeies government portal to submit building permits (*oikodomikes adeies*). The portal has **no public API** -- every interaction requires manual form filling, document uploads, and status checking across a fragmented bureaucratic process.

OpenAdeia automates the entire permit lifecycle: from project intake and document management through fee calculation, TEE XML generation, and browser-based submission to the government portal via Playwright.

---

## Preview

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dashboard-dark.png">
  <img alt="OpenAdeia — Πίνακας Ελέγχου" src="docs/screenshots/dashboard-light.png" width="900">
</picture>

<p align="center">
  <img alt="OpenAdeia — Λεπτομέρειες Φακέλου" src="docs/screenshots/project-detail.png" width="440">
  &nbsp;
  <img alt="OpenAdeia — Αμοιβολόγιο (ΠΔ 696/74)" src="docs/screenshots/project-fees.png" width="440">
</p>

---

## Architecture

```mermaid
graph TB
    Browser[Browser] -->|HTTPS| Nginx[Nginx reverse proxy]
    Nginx --> Frontend["Frontend<br/>React 18 + Vite + Tailwind"]
    Nginx --> API["Fastify API :4000"]
    API --> PG[("PostgreSQL 16<br/>+ PostGIS")]
    API --> Redis[("Redis 7")]
    API --> MinIO[("MinIO<br/>S3 storage")]
    API --> Meilisearch[("Meilisearch")]
    Redis --> BullMQ["BullMQ Workers"]
    BullMQ --> EmailW["Email sender"]
    BullMQ --> TEEW["TEE sync"]
    BullMQ --> PDFW["PDF generator"]
    TEEW -->|Playwright| TEEPortal["TEE e-Adeies<br/>gov portal"]
```

| Layer     | Technology                                   |
|-----------|----------------------------------------------|
| Frontend  | React 18, Vite, Tailwind CSS, Zustand, TanStack Query |
| Backend   | Node.js 20, Fastify 4, Knex.js, Zod          |
| Database  | PostgreSQL 16 + PostGIS, uuid-ossp            |
| Queue     | BullMQ + Redis 7                              |
| Storage   | MinIO (S3-compatible, self-hosted)             |
| Auth      | JWT (@fastify/jwt), Keycloak-ready             |
| Billing   | Stripe (SaaS mode)                             |
| Scraping  | Playwright Core (TEE portal automation)        |
| Search    | Meilisearch                                    |
| CI/CD     | GitHub Actions, Docker, ghcr.io                |
| Monitoring| Sentry (frontend + backend), Telegram alerts   |

---

## Features

### Permit Management
- **Project lifecycle** -- create, track, and manage building permits through a multi-stage workflow
- **9 permit types** supported with declarative rule engine (`nok-rules.json`)
- **Document management** -- upload, organize, and track required studies and documents per permit type
- **Workflow engine** -- `init` -> `data_collection` -> `studies` -> `signatures` -> `submission` -> `review` -> `approved`
- **Client management** -- track property owners, their projects, and required documents

### TEE e-Adeies Integration
- **XML generation** -- produces valid XML conforming to `AdeiaAitisiInput.xsd` v2.9.1, including all 15 mandatory `EKDOSI_DD` rows
- **Browser automation** -- Playwright-based scraping for TEE portal sync (async, returns 202 + job ID)
- **Submission tracking** -- monitor permit status through the government review process

### Fee Calculator
- **Full implementation** of the ΠΔ 696/74 engineer fee formula: `beta = kappa + mu / cbrt(Sigma / 1000*lambda)`
- **All kappa/mu coefficients** for different building categories
- **Official PDF generation** for fee documentation (Pro tier)

### Client Portal
- Public-facing portal for property owners to track their permit progress
- Document upload and status visibility
- Email notifications with BullMQ queue

### SaaS Capabilities (v2)
- **Multi-tenancy** -- row-level tenant isolation with `tenant_id` across all tables
- **Stripe billing** -- subscription management with webhook integration
- **Feature flags** -- conditional route loading based on plan tier
- **Usage metering** -- project count, storage, and team member limits
- **Admin panel** -- tenant management and system overview
- **Audit logging** -- every state change logged with actor and timestamp

---

## Quick Start

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Node.js](https://nodejs.org/) | 20+ | Backend and frontend runtime |
| [Docker](https://docs.docker.com/get-docker/) | 24+ | Required for all setups |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ | Bundled with Docker Desktop |
| [Make](https://www.gnu.org/software/make/) | Any | Optional, for convenience targets |

### Full Stack (Docker)

```bash
git clone https://github.com/ppapadeas/openadeia.git
cd openadeia

# Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, SMTP credentials, etc.

# Start all 7 services
docker compose up -d

# Run migrations and seed data
docker compose exec api npm run migrate
docker compose exec api npm run seed

# Open http://localhost:3000
```

### Local Development

```bash
# 1. Start infrastructure (PostgreSQL + MinIO)
docker compose -f docker-compose.dev.yml up -d

# 2. Backend (terminal 1)
cd backend
cp ../.env.example .env
npm install
npm run migrate
npm run seed
npm run dev            # http://localhost:4000

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev            # http://localhost:3000
```

### Using Make

```bash
make install           # Install all dependencies
make dev-infra         # Start DB + MinIO containers
make dev               # Start everything (infra + backend + frontend)
make migrate           # Run pending migrations
make lint              # Lint backend + frontend
make up                # Docker Compose full stack
make logs              # Tail all service logs
make help              # Show all available targets
```

---

## Project Structure

```
openadeia/
├── backend/
│   ├── src/
│   │   ├── routes/            # 16 route modules (auth, projects, tee, billing, ...)
│   │   ├── services/          # Business logic (fee-calculator, workflow-engine, tee-client, ...)
│   │   ├── hooks/             # Fastify hooks (tenant isolation, audit logging)
│   │   ├── jobs/              # BullMQ workers (email queue, email sender)
│   │   ├── plugins/           # Fastify plugins (error monitoring)
│   │   ├── utils/             # XML generator (TEE XSD-compliant)
│   │   ├── config/            # DB, MinIO, Redis, email, plan limits
│   │   └── app.js             # Fastify app builder
│   ├── migrations/            # 10 Knex migrations (001_ through 010_)
│   └── config/
│       └── nok-rules.json     # Declarative permit rules (9 types)
├── frontend/
│   └── src/
│       ├── components/        # Domain-organized: projects/, documents/, workflow/,
│       │                      #   nok/, fees/, tee/, portal/, admin/, clients/, ...
│       ├── api/               # Axios API wrappers
│       ├── store/             # Zustand state management
│       └── utils/             # Permit types, stages, statuses
├── xsd/                       # TEE XML schemas (AdeiaAitisiInput.xsd v2.9.1)
├── scripts/                   # deploy.sh, setup-server.sh, nginx-site.conf
├── docs/v2-architecture/      # Architecture specs, code reviews, SaaS readiness
├── docker-compose.yml         # Full stack (7 services)
├── docker-compose.dev.yml     # Dev infra only (DB + MinIO)
├── docker-compose.prod.yml    # Production overrides
└── Makefile                   # Developer convenience targets
```

---

## Configuration

<details>
<summary><strong>Environment Variables</strong> (click to expand)</summary>

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://eadeies:eadeies@localhost:5432/eadeies` |
| `JWT_SECRET` | Secret for JWT signing | `dev-secret-change-in-production` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `MINIO_ENDPOINT` | MinIO host | `localhost` |
| `MINIO_PORT` | MinIO port | `9000` |
| `MINIO_ACCESS_KEY` | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO secret key | `minioadmin` |
| `MINIO_BUCKET` | S3 bucket name | `permits` |
| `FRONTEND_URL` | CORS origin | `http://localhost:3000` |
| `SMTP_HOST` | SMTP server | -- |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | -- |
| `SMTP_PASS` | SMTP password | -- |
| `SMTP_FROM` | Sender address | `noreply@eadeies.local` |
| `SENTRY_DSN` | Backend Sentry DSN | -- |
| `VITE_SENTRY_DSN` | Frontend Sentry DSN | -- |
| `SAAS_MODE` | Enable SaaS features (billing, tenants) | `false` |
| `STRIPE_SECRET_KEY` | Stripe API key (enables billing routes) | -- |

</details>

---

## Testing

```bash
# Backend tests (Vitest)
cd backend && npm test
cd backend && npm run test:watch    # Watch mode

# Frontend tests (Vitest + Testing Library)
cd frontend && npm test
cd frontend && npm run test:watch   # Watch mode

# Lint
cd backend && npm run lint
cd frontend && npm run lint
```

---

## API Overview

<details>
<summary><strong>API endpoints</strong> (click to expand)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register user |
| `POST` | `/api/auth/login` | Login, receive JWT |
| `POST` | `/api/auth/signup-org` | Register user + create tenant |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `POST` | `/api/auth/reset-password` | Reset password with token |
| `GET` | `/api/projects` | List projects (filter, paginate) |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/:id` | Project detail |
| `PATCH` | `/api/projects/:id` | Update project |
| `POST` | `/api/projects/:id/advance` | Advance workflow stage |
| `GET` | `/api/projects/:id/xml` | Generate TEE XML |
| `GET` | `/api/projects/:id/documents` | List documents |
| `POST` | `/api/projects/:id/documents` | Upload document |
| `GET` | `/api/nok/rules/:type` | NOK rules for permit type |
| `POST` | `/api/fees/calculate` | Calculate engineer fees |
| `GET` | `/api/clients` | List clients |
| `GET` | `/api/search?q=` | Full-text search |
| `POST` | `/api/tee/sync` | Trigger TEE sync (async, 202) |
| `GET` | `/api/portal/:token` | Client portal (public) |
| `GET` | `/api/tenant/usage` | Tenant usage stats |
| `GET` | `/api/tenant/audit` | Tenant audit log |
| `GET` | `/api/admin/tenants` | Admin: list tenants |
| `GET` | `/api/admin/metrics` | Admin: system metrics |
| `POST` | `/api/billing/checkout` | Create Stripe checkout session |
| `GET` | `/health` | Health check |

</details>

---

## SaaS Plans

OpenAdeia supports both hosted SaaS and self-hosted deployment from a single codebase. Set `SAAS_MODE=true` to enable billing and tenant management.

| Capability | Free | Pro | Enterprise | Self-Hosted |
|------------|------|-----|------------|-------------|
| Projects | 5 | Unlimited | Unlimited | Unlimited |
| Storage | 500 MB | 10 GB | Unlimited | Unlimited |
| Team members | 1 | 3 | Unlimited | Unlimited |
| NOK checker | Yes | Yes | Yes | Yes |
| Fee calculator | Basic | + Official PDF | + Official PDF | Full |
| TEE e-Adeies sync | -- | Yes | Yes | Yes |
| Client portal | -- | -- | Yes | Yes |
| API access | -- | -- | Yes | Yes |

---

## Deployment

Production runs on a self-hosted server behind Nginx with Let's Encrypt SSL.

**CI/CD pipeline** (GitHub Actions):
1. **Test** -- lint + unit tests for backend and frontend
2. **Build** -- Docker images pushed to `ghcr.io`
3. **Deploy** -- SSH to server, pull images, rolling restart, run migrations

```bash
# Tag a release (triggers full CI/CD pipeline)
make release TAG=v1.3.0

# Manual deploy
make deploy SERVER=user@host

# First-time server setup
make setup-server SERVER=user@host
```

**Server layout:** `/opt/openadeia` with Docker Compose, Nginx reverse proxy on the host.

---

## Workflow

Building permits follow a structured lifecycle:

```
init --> data_collection --> studies --> signatures --> submission --> review --> approved
              ^                                           |
              └───────────── (rejection) ─────────────────┘
```

Each permit type defines its required studies, documents, approvals, and signer roles through the declarative NOK rules engine. The system tracks completion status and blocks stage advancement until all requirements are met.

---

## Contributing

Pull requests are welcome. The project uses ESLint for both frontend and backend.

```bash
# Fork and clone
git clone https://github.com/<you>/openadeia.git

# Install dependencies
make install

# Start development environment
make dev

# Run tests before submitting
cd backend && npm test
cd frontend && npm test
```

**Note:** OpenAdeia is licensed under AGPL-3.0. If you modify and deploy this as a network service, you must make your source code available under the same license.

---

## Security

To report a security vulnerability, please see [SECURITY.md](SECURITY.md).

Do **not** open a public issue for security reports.

---

## License

[GNU Affero General Public License v3.0](LICENSE)

---

## Links

- **Website:** [openadeia.org](https://openadeia.org)
- **GitHub:** [ppapadeas/openadeia](https://github.com/ppapadeas/openadeia)
- **TEE e-Adeies:** [e-adeies.gov.gr](https://www.e-adeies.gov.gr/)
- **NOK (Building Code):** [N.4067/2012](https://www.e-nomothesia.gr/kat-oikodomos/nomos-4067-2012.html)
