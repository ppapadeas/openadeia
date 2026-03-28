# OpenAdeia — Development Plan

## Current Status (March 2026)

### Phase 1 — MVP ✅ Complete
- [x] Project CRUD + workflow state machine
- [x] Document upload (MinIO) + SHA-256 hash verification
- [x] NOK rules engine (declarative JSON, 9 permit types)
- [x] TEE XML generator (XSD v2.9.1 compliant)
- [x] Email compose (BullMQ queue)
- [x] React dashboard (dark theme, Tailwind)
- [x] Client management
- [x] Full-text search (ILIKE)
- [x] Docker Compose deployment
- [x] GitHub Actions CI/CD

### Phase 1.5 — Extended MVP ✅ Complete
- [x] TEE e-Adeies browser automation (Playwright scraping)
- [x] Async TEE sync (job-based, 202 + polling)
- [x] TEE application import
- [x] Fee calculator (ΠΔ 696/74 formula)
- [x] Fee calculator UI component
- [x] Client portal Phase 1 (token-based, multi-step wizard)
- [x] Client portal Phase 2 (PDF generation, emails, digital signatures)
- [x] Error monitoring (Sentry + Telegram)
- [x] Auto-migrations on startup
- [x] Project delete functionality
- [x] Graceful Redis reconnect

---

## Phase 2 — Stability & Polish (Next)

### Infrastructure & DevOps
- [ ] Health check dashboard (uptime, service status)
- [ ] Database backups automation (scheduled pg_dump)
- [ ] Log aggregation (structured JSON logs → file rotation)
- [ ] Redis persistence configuration
- [ ] MinIO bucket lifecycle policies

### Testing & Quality
- [ ] Integration tests with real PostgreSQL (test containers)
- [ ] Frontend component tests (React Testing Library)
- [ ] E2E tests (Playwright for UI flows)
- [ ] API contract tests (OpenAPI spec generation)
- [ ] Test coverage reporting in CI

### Security
- [ ] Keycloak RBAC integration (activate prepared OIDC)
- [ ] Rate limiting per user (not just per IP)
- [ ] Audit log for all data mutations
- [ ] CSP headers on frontend
- [ ] Secrets rotation tooling

### UX Improvements
- [ ] Bulk document upload (drag & drop multiple files)
- [ ] Project templates (pre-fill from common configurations)
- [ ] Notification system (in-app + email)
- [ ] Dashboard analytics (projects by stage, type, month)
- [ ] Mobile-responsive improvements

---

## Phase 3 — Advanced Features

### TEE Integration
- [ ] TEE XML auto-upload via Playwright (form fill + upload)
- [ ] TEE status change notifications
- [ ] Bi-directional sync (detect TEE-side changes)
- [ ] Multiple TEE account support

### Document Automation
- [ ] PDF auto-generation (αιτήσεις, ΥΔ, εξουσιοδοτήσεις)
- [ ] Document template engine (variables → PDF)
- [ ] Digital signature integration (EU DSS or qualified eIDAS)
- [ ] Document versioning (track revisions)

### Financial
- [ ] Per-project cost tracking (τέλη ΤΕΕ, Δήμου, ΕΦΚΑ)
- [ ] Invoice generation
- [ ] Payment status tracking
- [ ] Fee comparison reports

### Communication
- [ ] IMAP incoming email auto-classification (per project)
- [ ] Email thread view (conversation history)
- [ ] Client portal messaging (real-time)
- [ ] SMS notifications (critical deadlines)

### Search & Intelligence
- [ ] Meilisearch full-text search integration
- [ ] Project similarity detection
- [ ] Deadline predictions (based on historical data)
- [ ] Smart document classification (ML-based)

---

## Phase 4 — Scale & Ecosystem

- [ ] Multi-engineer office support (team management)
- [ ] Role-based access control (per project)
- [ ] API for third-party integrations
- [ ] Plugin system (custom rules, workflows)
- [ ] PWA mobile app
- [ ] Offline mode (sync when online)
- [ ] Data export (CSV, Excel, PDF reports)
- [ ] Multi-language UI (English, beyond Greek)

---

## Technical Debt & Known Issues

- [ ] TEE scraper fragile — Oracle ADF DOM changes can break selectors
- [ ] In-memory job store (job-store.js) — should use Redis for persistence
- [ ] Keycloak configured but not active — JWT auth is basic
- [ ] Meilisearch in compose but not integrated
- [ ] Large tee-discovery-report JSON committed to repo (should be gitignored)
- [ ] No database seeding script for development
- [ ] Frontend error boundaries missing
- [ ] No API rate limiting per authenticated user
