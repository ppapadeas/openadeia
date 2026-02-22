# OpenAdeia

Open-source web application for automating Greek building permits (οικοδομικές άδειες) via the TEE e-Adeies system.

**License:** AGPL-3.0
**Stack:** React 18 + Vite + Tailwind · Fastify · PostgreSQL 16 + PostGIS · MinIO · BullMQ + Redis · Keycloak

---

## Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env with your SMTP credentials

docker compose up -d

# Run migrations
docker compose exec api npm run migrate
docker compose exec api npm run seed

# Open
open http://localhost:3000
```

## Local Development

```bash
# 1. Start infrastructure only
docker compose -f docker-compose.dev.yml up -d

# 2. Backend
cd backend
cp ../.env.example .env
npm install
npm run migrate
npm run seed
npm run dev   # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev   # http://localhost:3000
```

---

## Architecture

```
openadeia/
├── backend/           # Fastify API
│   ├── src/
│   │   ├── routes/        # REST endpoints
│   │   ├── services/      # Business logic (workflow, NOK rules)
│   │   ├── jobs/          # BullMQ workers (email, PDF)
│   │   ├── utils/         # XML generator (TEE XSD compliant)
│   │   └── config/        # DB, MinIO, Redis, Email
│   ├── migrations/        # Knex migrations
│   └── config/
│       └── nok-rules.json # Declarative permit rules
├── frontend/          # React + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── projects/  # Dashboard, ProjectDetail, ProjectForm
│       │   ├── documents/ # DocList (upload, sign, download)
│       │   ├── workflow/  # StageIndicator
│       │   ├── nok/       # RulesViewer, Checklist
│       │   ├── email/     # ComposeDialog
│       │   └── clients/   # ClientList, ClientForm
│       ├── api/           # Axios wrappers
│       ├── store/         # Zustand state
│       └── utils/         # Permit types, stages, statuses
├── xsd/               # TEE XSD schemas (AdeiaAitisiInput.xsd)
└── docker-compose.yml
```

## TEE XSD Compliance

The XML generator ([`backend/src/utils/xml-generator.js`](backend/src/utils/xml-generator.js)) produces valid XML conforming to `AdeiaAitisiInput.xsd` (v2.9.1, Jan 2025), including:

- All required elements (AITISI_AA, YD_ID, DIMOS_AA, AITISI_DESCR, ADDR, …)
- All 15 mandatory `EKDOSI_DD` rows
- Owner data (AITISI_OWNER with SURNAME/NAME/F_NAME/AFM/ADT)
- Engineer data (AITISI_ENGINEER with AMH)
- Approvals (AITISI_APPROVAL + AITISI_APPROVAL_EXT v2.9.1)
- Previous permits (AITISI_PREV_PRAXI)

Generate XML for a project: `GET /api/projects/:id/xml`

## Permit Types

| Code | Label | Est. Days |
|------|-------|-----------|
| `vod` | Βεβαίωση Όρων Δόμησης | 15 |
| `cat1` | Έγκριση Εργασιών Μικρής Κλίμακας | 30 |
| `cat2` | Οικοδομική Άδεια Κατ. 2 | 60 |
| `cat3` | Οικοδομική Άδεια Κατ. 3 | 120 |

## Workflow Stages

```
init → data_collection → [studies →] [signatures →] submission → review → approved
                  ↑___________(rejection)___________↑
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects (filter, paginate) |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Project detail |
| PATCH | `/api/projects/:id` | Update project |
| POST | `/api/projects/:id/advance` | Advance workflow stage |
| GET | `/api/projects/:id/xml` | Generate TEE XML |
| GET | `/api/projects/:id/documents` | List documents |
| POST | `/api/projects/:id/documents` | Upload document |
| GET | `/api/nok/rules/:type` | NOK rules for permit type |
| GET | `/api/nok/checklist/:type` | Document checklist |
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create client |
| GET | `/api/search?q=` | Full-text search |

## Services

| Port | Service |
|------|---------|
| 3000 | Frontend (React) |
| 4000 | API (Fastify) |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 9000 | MinIO S3 API |
| 9001 | MinIO Console |
| 8080 | Keycloak |
| 7700 | Meilisearch |

## Roadmap

### Phase 1 (current) — MVP ✅
- Project CRUD with workflow state machine
- Document upload to MinIO with SHA-256 hash
- NOK rules engine (declarative JSON)
- TEE XML generator (XSD compliant)
- Email compose with BullMQ queue
- React dashboard with dark theme

### Phase 2
- Digital signatures (EU DSS)
- Client portal (read-only)
- IMAP incoming email auto-classification
- Keycloak RBAC integration

### Phase 3
- TEE e-Adeies browser automation (Playwright)
- PDF auto-generation (αιτήσεις, ΥΔ)
- Financial tracking (αμοιβές, τέλη)
- PWA mobile support

---

## Contributing

Pull requests welcome. Please read AGPL-3.0 license terms — any modified version deployed as a network service must make source available.

## Related

- [TEE e-Adeies](https://www.e-adeies.gov.gr/)
- [TEE Documentation](https://web.tee.gr/e-adeies/egcheiridia-chrisis-chrisima-entypa/)
- [ΝΟΚ — Ν.4067/2012](https://www.e-nomothesia.gr/kat-oikodomos/nomos-4067-2012.html)
