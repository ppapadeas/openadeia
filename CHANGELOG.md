# Changelog

All notable changes to OpenAdeia are documented here.

## [Unreleased]

## 2026-03-07 — Fee Calculator Rewrite
- **fix:** Fee calculator rewritten per ΠΔ 696/74 formula (β = κ + μ/∛(Σ/1000λ))
- **fix:** Deadline empty string → undefined to avoid PostgreSQL date parse error

## 2026-03-06 — Error Monitoring & Client Portal Phase 2
- **feat:** Auto-migrate on startup + error monitoring via Telegram
- **ci:** Trigger rebuild with Sentry frontend DSN
- **feat:** Client portal Phase 2 — PDF generation, emails, digital signatures
- **feat:** Client portal module (Phase 1) — token-based access, multi-step wizard

## 2026-03-05 — Fee Engine & TEE Scraper Fixes
- **fix:** Move looksLikePermitCode to block scope (ESLint no-inner-declarations)
- **fix:** Parse results table rows by A/A numeric pattern
- **fix:** Navigate to 'Οι αιτήσεις μου' search before scraping TEE table
- **fix:** Click correct ADF nav item for permits list
- **debug:** Add TEE_DEBUG screenshots + nav text dump for scraper diagnosis
- **feat:** Add delete project button with confirm dialog
- **fix:** Click Αναζήτηση nav after login before scraping permit table
- **feat:** Add fee calculator UI (αμοιβές μηχανικών) per project
- **fix:** Graceful Redis reconnect — don't crash API when Redis unavailable
- **feat:** Fee engine (αμοιβές μηχανικών) — ΦΕΚ Β 2422/2013

## 2026-03-04 — TEE Integration & Async Sync
- **fix:** Frontend polling for async TEE sync + fix debug var refs
- **fix:** Make TEE sync async to prevent 502 proxy timeouts
- **fix(lint):** Resolve all ESLint errors in tee-client.js and workflow-engine.js
- **fix:** Wait for Oracle ADF splash/boot to complete before table extraction
- **fix:** Handle Oracle ADF virtual-scrolling table in TEE sync scraper

## 2026-03-03 — TEE Discovery & Submission
- **feat:** Add TEE ADF discovery report from intercept run
- **feat:** Add ADF REST discovery and XHR interceptor scripts
- **test:** Add POST /api/tee/submit/:id route tests
- **feat:** TEE e-Adeies XML submission via Playwright browser automation
- **test:** Comprehensive TEE sync/import/refresh + XML generator tests

## 2026-03-02 — Initial Release
- Project CRUD with workflow state machine
- Document upload to MinIO with SHA-256 hash verification
- NOK rules engine (declarative JSON, 9 permit types)
- TEE XML generator (XSD v2.9.1 compliant)
- Email compose with BullMQ queue
- React dashboard with dark theme
- Client management (physical + legal entities)
- Full-text search (projects, clients)
- Docker Compose deployment (7 services)
- GitHub Actions CI/CD pipeline
- Nginx reverse proxy with Let's Encrypt SSL
