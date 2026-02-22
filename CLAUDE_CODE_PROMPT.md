# e-Άδειες Manager — Claude Code Handoff

## Τι είναι αυτό

Κατασκευάζουμε open-source web app για αυτοματοποίηση ελληνικών οικοδομικών αδειών μέσω του συστήματος e-Adeies του ΤΕΕ. Πρόκειται για production-ready εφαρμογή που θα ανταγωνιστεί εμπορικές λύσεις (EasyBuild κλπ). License: AGPL-3.0.

## Πλήρης Αρχιτεκτονική

### Tech Stack (αυστηρά open-source)
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Fastify (προτίμηση) ή Express
- **Database**: PostgreSQL 16 με PostGIS extension
- **Queue**: BullMQ + Redis 7
- **File Storage**: MinIO (S3-compatible)
- **Auth**: Keycloak (OAuth2/OIDC, RBAC)
- **Email**: Nodemailer (SMTP out) + IMAP listener (incoming)
- **Digital Signatures**: EU DSS (Digital Signature Service)
- **Search**: Meilisearch
- **Deployment**: Docker Compose
- **CI/CD**: Gitea Actions ή GitHub Actions

### Monorepo Structure
```
eadeies-manager/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── README.md
├── LICENSE (AGPL-3.0)
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── api/              # Axios/fetch wrappers
│   │   ├── components/
│   │   │   ├── layout/       # Sidebar, Header, Shell
│   │   │   ├── projects/     # ProjectList, ProjectDetail, ProjectForm
│   │   │   ├── documents/    # DocUpload, DocList, DocStatus
│   │   │   ├── workflow/     # StageIndicator, AdvanceButton
│   │   │   ├── nok/          # RulesViewer, Checklist
│   │   │   ├── email/        # ComposeDialog, ThreadView
│   │   │   └── clients/      # ClientList, ClientForm
│   │   ├── hooks/
│   │   ├── store/            # Zustand ή React Context
│   │   └── utils/
│   └── public/
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js          # Fastify bootstrap
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   ├── minio.js
│   │   │   ├── redis.js
│   │   │   └── email.js
│   │   ├── routes/
│   │   │   ├── projects.js
│   │   │   ├── documents.js
│   │   │   ├── studies.js
│   │   │   ├── workflow.js
│   │   │   ├── nok.js
│   │   │   ├── email.js
│   │   │   ├── sign.js
│   │   │   └── clients.js
│   │   ├── services/
│   │   │   ├── workflow-engine.js
│   │   │   ├── nok-rules.js
│   │   │   ├── email-service.js
│   │   │   ├── storage-service.js
│   │   │   ├── signature-service.js
│   │   │   └── tee-bridge.js
│   │   ├── models/           # Knex/Objection.js ή Drizzle ORM
│   │   ├── middleware/
│   │   │   ├── auth.js       # Keycloak JWT validation
│   │   │   └── validate.js   # Zod schemas
│   │   ├── jobs/             # BullMQ workers
│   │   │   ├── email-sender.js
│   │   │   ├── imap-poller.js
│   │   │   └── pdf-generator.js
│   │   └── utils/
│   │       └── xml-generator.js  # TEE XML conforming to XSD
│   ├── migrations/           # Knex migrations
│   ├── seeds/                # NOK rules, sample data
│   └── config/
│       └── nok-rules.json    # Declarative rules engine config
├── xsd/                      # TEE XSD schemas (download below)
│   └── README.md
└── docs/
    └── ARCHITECTURE.md
```

## ΠΡΩΤΟ ΒΗΜΑ — Κατέβασε και parse τα XSD schemas

**ΚΡΙΣΙΜΟ**: Πριν γράψεις κώδικα, κατέβασε το αρχείο XSD:

```bash
# Download XSD package
wget -O master_dataxsd-2.rar "https://web.tee.gr/wp-content/uploads/master_dataxsd-2.rar"

# Extract (install unrar if needed)
# apt-get install unrar || pip install unrar
unrar x master_dataxsd-2.rar ./xsd/

# Alternatively try with 7z
# apt-get install p7zip-full && 7z x master_dataxsd-2.rar -o./xsd/

# The key file is: AdeiaAitisiInput.xsd
# Parse it and map all fields/types to the database schema
```

Επίσης κατέβασε τη δομή πεδίων:
```bash
wget -O struct.xlsx "http://portal.tee.gr/portal/page/portal/TEE/MyTEE/adeies/XML/struct20200109.xlsx"
```

Πλήρης κατάλογος αρχείων: https://web.tee.gr/e-adeies/egcheiridia-chrisis-chrisima-entypa/

**Στόχος**: Parse το XSD, εξήγαγε ΟΛΑ τα elements/types/enums, και χρησιμοποίησέ τα για:
1. Ακριβές database schema (mapping XSD → PostgreSQL)
2. Zod validation schemas (frontend+backend)
3. XML generator module (project data → valid XML για upload στο e-Adeies)

## Database Schema

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'engineer', -- engineer, admin, viewer
  keycloak_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  afm VARCHAR(9),           -- ΑΦΜ
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,        -- PRJ-2026-001
  type VARCHAR(10) NOT NULL,                -- vod, cat1, cat2, cat3
  title VARCHAR(255) NOT NULL,
  stage VARCHAR(30) NOT NULL DEFAULT 'init',
  -- stages: init, data_collection, studies, signatures, submission, review, approved
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  client_id UUID REFERENCES clients(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deadline DATE,
  tee_permit_code VARCHAR(50),    -- Κωδικός πράξης στο e-Adeies
  tee_submission_date DATE,
  notes TEXT
);

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  kaek VARCHAR(30),              -- ΚΑΕΚ κτηματολογίου
  address TEXT,
  municipality VARCHAR(100),
  area_sqm DECIMAL(10,2),
  coordinates GEOMETRY(Point, 4326),  -- PostGIS SRID 4326
  zoning_info JSONB,             -- {artiotita, sd, kalypsi, ypsos, ...}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL,  -- topio, title_deed, tafottita, arch_study, static_study...
  label VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- pending, uploaded, signed, rejected
  file_path VARCHAR(500),           -- MinIO path
  file_size BIGINT,
  file_hash VARCHAR(64),            -- SHA-256
  mime_type VARCHAR(100),
  signer_role VARCHAR(30),
  signed_at TIMESTAMPTZ,
  signature_ref VARCHAR(255),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  notes TEXT
);

CREATE TABLE workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  from_stage VARCHAR(30),
  to_stage VARCHAR(30),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL,  -- sent, received
  from_address VARCHAR(255),
  to_address VARCHAR(255),
  subject VARCHAR(500),
  body TEXT,
  attachments JSONB,               -- [{name, minio_path, size}]
  message_id VARCHAR(255),         -- Email Message-ID header
  in_reply_to VARCHAR(255),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_projects_stage ON projects(stage);
CREATE INDEX idx_projects_type ON projects(type);
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_workflow_project ON workflow_logs(project_id);
CREATE INDEX idx_emails_project ON emails(project_id);
```

## NOK Rules Engine (config/nok-rules.json)

Declarative JSON. Κάθε τύπος πράξης ορίζει τι χρειάζεται:

```json
{
  "vod": {
    "label": "Βεβαίωση Όρων Δόμησης",
    "nokArticles": ["Ν.4067/2012 Άρθρο 26"],
    "requiredStudies": [],
    "requiredDocuments": [
      {"id": "topio", "label": "Τοπογραφικό Διάγραμμα", "signerRole": "surveyor"},
      {"id": "title_deed", "label": "Τίτλος Ιδιοκτησίας", "signerRole": null},
      {"id": "identity", "label": "Αστυνομική Ταυτότητα", "signerRole": null},
      {"id": "tafottita", "label": "Ταυτότητα Κτιρίου", "signerRole": null}
    ],
    "requiredApprovals": [],
    "workflowStages": ["init", "data_collection", "submission", "review", "approved"],
    "estimatedDays": 15,
    "fees": {"tee": true, "municipality": false, "efka": false}
  },
  "cat1": {
    "label": "Έγκριση Εργασιών Μικρής Κλίμακας",
    "nokArticles": ["Ν.4067/2012 Άρθρο 29", "Ν.4495/2017"],
    "requiredStudies": [
      {"id": "arch", "label": "Αρχιτεκτονική Μελέτη", "signerRole": "architect"}
    ],
    "requiredDocuments": [
      {"id": "topio", "label": "Τοπογραφικό Διάγραμμα", "signerRole": "surveyor"},
      {"id": "title_deed", "label": "Τίτλος Ιδιοκτησίας", "signerRole": null},
      {"id": "identity", "label": "Αστυνομική Ταυτότητα", "signerRole": null},
      {"id": "tax_cert", "label": "Φορολογική Ενημερότητα", "signerRole": null},
      {"id": "ika_cert", "label": "Ασφαλιστική Ενημερότητα ΕΦΚΑ", "signerRole": null}
    ],
    "requiredApprovals": [],
    "workflowStages": ["init", "data_collection", "studies", "submission", "review", "approved"],
    "estimatedDays": 30,
    "fees": {"tee": true, "municipality": false, "efka": true}
  },
  "cat2": {
    "label": "Οικοδομική Άδεια (Κατηγορία 2)",
    "nokArticles": ["Ν.4067/2012 Άρθρα 3-7, 26-28", "Ν.4495/2017"],
    "requiredStudies": [
      {"id": "arch", "label": "Αρχιτεκτονική Μελέτη", "signerRole": "architect"},
      {"id": "static", "label": "Στατική Μελέτη", "signerRole": "civil_eng"},
      {"id": "mech", "label": "Η/Μ Μελέτη", "signerRole": "mech_eng"},
      {"id": "energy", "label": "Ενεργειακή Μελέτη", "signerRole": "energy_eng"},
      {"id": "passive_fire", "label": "Μελέτη Παθητικής Πυροπροστασίας", "signerRole": "fire_eng"}
    ],
    "requiredDocuments": [
      {"id": "topio", "label": "Τοπογραφικό Διάγραμμα", "signerRole": "surveyor"},
      {"id": "title_deed", "label": "Τίτλος Ιδιοκτησίας", "signerRole": null},
      {"id": "identity", "label": "Αστυνομική Ταυτότητα", "signerRole": null},
      {"id": "tax_cert", "label": "Φορολογική Ενημερότητα", "signerRole": null},
      {"id": "ika_cert", "label": "Ασφαλιστική Ενημερότητα ΕΦΚΑ", "signerRole": null},
      {"id": "contracts", "label": "Εργολαβικά Συμφωνητικά", "signerRole": null},
      {"id": "amea", "label": "Μελέτη Προσβασιμότητας ΑΜΕΑ", "signerRole": "architect"}
    ],
    "requiredApprovals": ["ΥΔΟΜ", "Πυροσβεστική", "Δασαρχείο", "Αρχαιολογία", "Συμβούλιο Αρχιτεκτονικής"],
    "workflowStages": ["init", "data_collection", "studies", "signatures", "submission", "review", "approved"],
    "estimatedDays": 60,
    "fees": {"tee": true, "municipality": true, "efka": true}
  },
  "cat3": {
    "label": "Οικοδομική Άδεια (Κατηγορία 3)",
    "nokArticles": ["Ν.4067/2012", "Ν.4495/2017", "Ν.4759/2020"],
    "requiredStudies": [
      {"id": "arch", "label": "Αρχιτεκτονική Μελέτη", "signerRole": "architect"},
      {"id": "static", "label": "Στατική Μελέτη", "signerRole": "civil_eng"},
      {"id": "mech", "label": "Η/Μ Μελέτη", "signerRole": "mech_eng"},
      {"id": "energy", "label": "Ενεργειακή Μελέτη", "signerRole": "energy_eng"},
      {"id": "passive_fire", "label": "Μελέτη Παθητικής Πυροπροστασίας", "signerRole": "fire_eng"},
      {"id": "active_fire", "label": "Μελέτη Ενεργητικής Πυροπροστασίας", "signerRole": "fire_eng"},
      {"id": "env", "label": "Περιβαλλοντική Μελέτη", "signerRole": "env_eng"},
      {"id": "acoustic", "label": "Ηχομόνωση - Ακουστική Μελέτη", "signerRole": "acoustic_eng"},
      {"id": "geo", "label": "Γεωτεχνική Μελέτη", "signerRole": "geotechnical_eng"}
    ],
    "requiredDocuments": [
      {"id": "topio", "label": "Τοπογραφικό Διάγραμμα", "signerRole": "surveyor"},
      {"id": "title_deed", "label": "Τίτλος Ιδιοκτησίας", "signerRole": null},
      {"id": "identity", "label": "Αστυνομική Ταυτότητα", "signerRole": null},
      {"id": "tax_cert", "label": "Φορολογική Ενημερότητα", "signerRole": null},
      {"id": "ika_cert", "label": "Ασφαλιστική Ενημερότητα ΕΦΚΑ", "signerRole": null},
      {"id": "contracts", "label": "Εργολαβικά Συμφωνητικά", "signerRole": null},
      {"id": "amea", "label": "Μελέτη Προσβασιμότητας ΑΜΕΑ", "signerRole": "architect"},
      {"id": "ktimatologio", "label": "Πιστοποιητικό Κτηματολογίου", "signerRole": null}
    ],
    "requiredApprovals": ["ΥΔΟΜ", "Πυροσβεστική", "Δασαρχείο", "Αρχαιολογία", "Συμβούλιο Αρχιτεκτονικής", "Περιβαλλοντική Αδειοδότηση"],
    "workflowStages": ["init", "data_collection", "studies", "signatures", "submission", "review", "approved"],
    "estimatedDays": 120,
    "fees": {"tee": true, "municipality": true, "efka": true}
  }
}
```

## Workflow State Machine

```
init → data_collection → studies → signatures → submission → review → approved
              ↑                       ↑                        │
              └───── (rejection) ──────┘                        │
                                                          (rejection)
```

Επίσημα states του e-Adeies (για sync):
- Προσωρινή αποθήκευση
- Σε υποβολή
- Σε έλεγχο
- Σε μεταβολή
- Εκδόθηκε
- Απορρίφθηκε
- Σε ανάκληση
- Ακυρώθηκε
- Τέθηκε αρχείο

## Πλήρης λίστα τύπων πράξεων (από εγχειρίδιο ΤΕΕ)

### ΕΓΚΡΙΣΕΙΣ
- Έγγραφη Βεβαίωση Όρων Δόμησης-Απαιτούμενων Εγκρίσεων αρθ.38§γ για Ο.Α. κατ.3
- Προέγκριση Οικοδομικής Άδειας
- Έγκριση ΕΥΠΑΤΕ (ξενοδοχεία 4*/5* >300 κλινών, ειδική τουριστική υποδομή, σύνθετα καταλύματα, ΠΟΤΑ)

### ΑΔΕΙΕΣ
- Οικοδομική άδεια Κατηγορίας 1 (χωρίς/με προέγκριση)
- Οικοδομική άδεια Κατηγορίας 2 (χωρίς/με προέγκριση)
- Οικοδομική άδεια Κατηγορίας 3 (με προέγκριση)
- Οικοδομική άδεια Ανακατασκευής Πυρόπληκτου (ν.4613/19, αρθ.14)
- Έγκριση Εργασιών Δόμησης Μικρής Κλίμακας
- Έγκριση εργασιών αποπεράτωσης σε αυθαίρετες κατασκευές
- Άδεια Κατεδάφισης
- Έγκριση Εκτέλεσης Εργασιών

### ΑΝΑΘΕΩΡΗΣΕΙΣ
- Αναθεώρηση Έγκρισης Δόμησης ν.4030/2011
- Αναθεώρηση έντυπης αδείας ΧΩΡΙΣ μεταβολή κάλυψης/δόμησης/όγκου
- Αναθεώρηση έντυπης αδείας κατ. 1/2/3 ΜΕ μεταβολή
- Αναθεώρηση Άδειας Κατεδάφισης ΜΕ/ΧΩΡΙΣ μεταβολή
- Ενημέρωση Έντυπης Οικοδομικής Άδειας / Άδειας Δόμησης
- Ενημέρωση Έντυπης Άδειας Κατεδάφισης
- Γνωστοποίηση Εργασιών Παλαιάς Οικοδομικής Άδειας

## API Routes

```
GET    /api/projects                    # Λίστα φακέλων (+ filters, pagination)
POST   /api/projects                    # Νέος φάκελος
GET    /api/projects/:id                # Λεπτομέρειες
PATCH  /api/projects/:id                # Update
DELETE /api/projects/:id                # Soft delete

GET    /api/projects/:id/documents      # Λίστα εγγράφων
POST   /api/projects/:id/documents      # Upload (multipart/form-data → MinIO)
PATCH  /api/projects/:id/documents/:did # Update status
DELETE /api/projects/:id/documents/:did # Remove

GET    /api/projects/:id/studies
PATCH  /api/projects/:id/studies/:sid

POST   /api/projects/:id/advance        # Workflow stage transition
GET    /api/projects/:id/timeline       # Workflow logs

POST   /api/projects/:id/email          # Send email
GET    /api/projects/:id/emails         # Email thread

GET    /api/nok/rules/:type             # NOK rules for permit type
GET    /api/nok/checklist/:type         # Document checklist

POST   /api/sign/request                # Digital signature request
GET    /api/sign/status/:ref            # Signature status

GET    /api/clients
POST   /api/clients
GET    /api/clients/:id
PATCH  /api/clients/:id

GET    /api/search?q=                   # Meilisearch proxy
```

## TEE e-Adeies Integration Context

- **ΔΕΝ υπάρχει public API** — μόνο XML file upload μέσω web interface
- Σύστημα: Oracle WebLogic + JSF + Oracle DB
- Schema: `AdeiaAitisiInput.xsd` (download above)
- Integration strategy: generate valid XML → Playwright browser automation για upload
- Μελλοντικά: αν ανοίξει SOAP/REST endpoint, switch σε direct API call
- Κατάλογος εγγράφων ΤΕΕ: https://web.tee.gr/e-adeies/egcheiridia-chrisis-chrisima-entypa/

## Docker Compose

```yaml
version: "3.8"

services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [api]
    environment:
      - VITE_API_URL=http://localhost:4000

  api:
    build: ./backend
    ports: ["4000:4000"]
    depends_on: [db, redis, minio]
    environment:
      - DATABASE_URL=postgres://eadeies:eadeies@db:5432/eadeies
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
      - KEYCLOAK_URL=http://keycloak:8080
      - KEYCLOAK_REALM=eadeies
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - IMAP_HOST=${IMAP_HOST}
      - IMAP_PORT=${IMAP_PORT}

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: eadeies
      POSTGRES_USER: eadeies
      POSTGRES_PASSWORD: eadeies
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes: ["miniodata:/data"]
    ports: ["9000:9000", "9001:9001"]

  keycloak:
    image: quay.io/keycloak/keycloak:latest
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports: ["8080:8080"]

  meilisearch:
    image: getmeili/meilisearch:latest
    environment:
      MEILI_MASTER_KEY: masterkey
    volumes: ["meilidata:/meili_data"]
    ports: ["7700:7700"]

volumes:
  pgdata:
  miniodata:
  meilidata:
```

## Οδηγίες Εκτέλεσης

### Phase 1 — MVP (ξεκίνα από εδώ)

1. **Initialize monorepo** — `mkdir eadeies-manager && cd eadeies-manager`
2. **Download & Parse XSD** — Κατέβασε `master_dataxsd-2.rar`, εξήγαγέ το, parse το `AdeiaAitisiInput.xsd`. Δημιούργησε mapping document (XSD element → DB column → Zod schema → form field).
3. **Backend scaffold** — Fastify + Knex/Drizzle + PostgreSQL migrations based on schema above
4. **NOK rules engine** — Load `nok-rules.json`, expose via `/api/nok/rules/:type`
5. **Project CRUD** — Full CRUD with validation (Zod)
6. **Document upload** — MinIO integration, SHA-256 hash, status tracking
7. **Workflow engine** — State machine with transition validation, auto-advance when all docs for a stage are complete
8. **Email service** — Nodemailer templates per stage, BullMQ queue for async sending
9. **Frontend** — React + Vite + Tailwind. Dashboard, project list/detail, document management, workflow progress, NOK checklist. Use the React prototype from our previous session as design reference (dark theme, DM Sans font).
10. **Docker Compose** — Wire everything together

### Phase 2
- Workflow auto-advance (event-driven)
- Digital signatures integration (EU DSS)
- Client portal (read-only project view for clients)
- Full-text search via Meilisearch
- IMAP listener for incoming email auto-classification

### Phase 3
- TEE e-Adeies bridge (Playwright automation for XML upload)
- PDF auto-generation (αιτήσεις, υπεύθυνες δηλώσεις)
- Financial tracking (αμοιβές μηχανικών, τέλη ΤΕΕ/Δήμου/ΕΦΚΑ)
- PWA mobile support
- Analytics dashboard

## Σημαντικές Σημειώσεις

- **Open source only** — Κανένα proprietary dependency. AGPL-3.0.
- **Greek locale** — UI στα ελληνικά, code/comments στα αγγλικά
- **Ξεκίνα με XSD parsing** — Αυτό θα ορίσει τη δομή δεδομένων σωστά
- **Εγχειρίδιο μηχανικού ΤΕΕ**: https://web.tee.gr/wp-content/uploads/manual_engineers-2_10-10-2019.pdf
- **MinIO bucket structure**: `permits/{project_id}/{documents|studies|signed|correspondence}/`
- **React prototype reference**: Θα σου δώσω το .jsx αν χρειαστεί (50K lines, full dashboard mockup)
