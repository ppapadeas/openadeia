# Architecture Notes

## XSD → Database Mapping

The TEE `AdeiaAitisiInput.xsd` defines the XML structure for building permit applications.
This mapping shows how XSD types map to the PostgreSQL schema.

### Type Hierarchy

```
AITISI (root element)
├── AITISI_TYPE fields → projects table
├── Address fields → properties table
├── EKDOSI → ekdosi table
│   └── EKDOSI_DD (15 rows) → ekdosi.dd_rows JSONB
├── AITISI_OWNER (1..n) → clients table
├── AITISI_ENGINEER (1..n) → users table
├── AITISI_DOC_RIGHT (0..n) → doc_rights table
├── AITISI_APPROVAL (0..n) → approvals table
├── AITISI_APPROVAL_EXT (0..n) → approvals.approval_type_ext
├── AITISI_PARKING (0..n) → stored as JSONB on ekdosi
└── AITISI_PREV_PRAXI (0..n) → prev_praxis table
```

### Custom Types in XSD

| XSD Type | Description | Regex |
|----------|-------------|-------|
| `integer01Type` | Boolean 0 or 1 | `[01]` |
| `decimalGE0Type` | Decimal ≥ 0 | `xs:decimal minInclusive 0.0` |
| `fdate` | Date or empty | `(dd/mm/yyyy)?` |

### EKDOSI_DD — 15 Mandatory Rows

The XSD requires exactly 15 `EKDOSI_DD` elements (minOccurs=15, maxOccurs=15).
Each has DD_ROW_TYPE (1–15) which must be unique within a permit.
These represent different building area categories (coverage, density, etc.).

## Workflow State Machine

```
                    ┌─────────────────────────────────────┐
                    │                                     │
  init ──► data_collection ──► studies ──► signatures ──► submission ──► review ──► approved
                    ▲               ▲              ▲          │
                    └───────────────┴──────────────┘          │
                              rejection                       │
                    ◄────────────────────────────────────────┘
                              rejection
```

Stage transitions are validated:
- `data_collection`: all required documents uploaded/signed
- `studies`: all required studies uploaded/signed
- `signatures`: all signable documents have status='signed'

## Storage Layout (MinIO)

```
permits/
└── {project_uuid}/
    ├── documents/   # Legal documents (title deed, identity, etc.)
    ├── studies/     # Engineering studies (arch, static, etc.)
    ├── signed/      # Digitally signed versions
    └── correspondence/  # Email attachments
```

## TEE XML Integration Strategy

Since TEE e-Adeies has no public API (Oracle WebLogic + JSF), the integration is:

**Phase 1 (current):** Generate valid XML locally
- `GET /api/projects/:id/xml` → returns UTF-8 XML
- Engineer manually uploads via e-Adeies web interface

**Phase 3 (planned):** Playwright browser automation
- Log in to e-Adeies
- Fill form fields from project data
- Upload XML file
- Extract issued permit code (TEE_PERMIT_CODE)

## Security Notes

- JWT authentication via Keycloak OIDC
- Files served via MinIO presigned URLs (1hr TTL) — no direct access
- SHA-256 hash stored on upload for integrity verification
- Zod validation on all API inputs
- Rate limiting: 200 req/min per IP
