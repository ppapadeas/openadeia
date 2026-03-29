# OpenAdeia — Database Multi-Tenancy Review
**Date:** 2026-03-28  
**Reviewer:** Μητσάρας (subagent)  
**Project:** `/home/pierros/git/openadeia` (Knex + PostgreSQL)  
**Scope:** Migrations 001–006, database config, all route files

---

## 1. Current Schema Analysis

### Architecture: Strictly Single-Tenant
The app is 100% single-tenant. There is no `tenant_id` anywhere. Every table references users and projects within a single shared namespace. The `portal_settings` table even has Pierros's personal details hardcoded as seed data (engineer name, ΑΜ ΤΕΕ, phone number).

### Table Inventory

| Table | Row Count Potential | Tenant-Sensitive? |
|---|---|---|
| `users` | Low (engineers of one firm) | ✅ Yes |
| `clients` | Medium | ✅ Yes |
| `projects` | Medium | ✅ Yes |
| `properties` | Medium | ✅ Yes |
| `ekdosi` | Medium | ✅ Yes |
| `documents` | High | ✅ Yes |
| `approvals` | Medium | ✅ Yes |
| `doc_rights` | Medium | ✅ Yes |
| `prev_praxis` | Medium | ✅ Yes |
| `workflow_logs` | High | ✅ Yes |
| `emails` | High | ✅ Yes |
| `fee_lambda` | Static reference data | ❌ Shared |
| `fee_calculations` | Medium | ✅ Yes |
| `portal_projects` | Low | ✅ Yes |
| `portal_steps` | Medium | ✅ Yes |
| `portal_form_data` | Medium | ✅ Yes |
| `portal_files` | High | ✅ Yes |
| `portal_templates` | Low | ⚠️ Per-tenant or shared |
| `portal_generated_docs` | Medium | ✅ Yes |
| `portal_project_engineers` | Low | ✅ Yes |
| `portal_settings` | Low | ✅ Yes (currently global) |
| `portal_activity_log` | High | ✅ Yes |

### Connection Pool
- **Config:** `min: 2, max: 10` (hardcoded in `database.js`)
- **Knexfile:** No pool config — uses Knex defaults (also `min: 2, max: 10`)
- Two separate Knex instances are created (one in `database.js`, one implied by `knexfile.js` for migrations) — minor waste but not a bug.
- For multi-tenant SaaS: 10 connections per process will become a bottleneck quickly.

### Query Patterns

**No tenant isolation.** Examples:

```js
// projects.js — full table scan, no tenant filter
db('clients').orderBy('surname')

// fees.js — no ownership check on fee_calculations
db('fee_calculations').where({ project_id: req.params.id })

// portal.js — token is the only guard, no tenant scope
db('portal_projects').where({ token: req.params.token }).first()
```

**N+1 issues found:**

1. **`GET /api/projects/:id/xml`** — 7 separate sequential queries (project, property, ekdosi, owners, engineers, docRights, approvals, prevPraxis). Should be a single JOIN or at minimum parallelized with `Promise.all`.

2. **`portal.js → loadPortalData()`** — 4 sequential queries (steps, then 3 `whereIn` calls). This is actually well-structured (batch fetch by stepIds), no N+1 here.

3. **`portal.js → form submit`** — loops over each form field with `select` + conditional `insert/update`. For small forms fine, but at scale use `INSERT ... ON CONFLICT DO UPDATE` (PostgreSQL upsert).

4. **`portal.js → review/sign/upload`** — chains 2–4 sequential awaits to fetch portal → project data that could be joined upfront.

---

## 2. Multi-Tenancy Strategy

### Option A: Row-Level `tenant_id` (Recommended)

Add `tenant_id UUID` to every tenant-sensitive table. Simple, compatible with Knex, easy to migrate.

**Pros:**
- Single database, single schema
- Knex queries unchanged except for adding `.where({ tenant_id })`
- Easy backup/restore per tenant (just filter by tenant_id)
- Works with existing PostgreSQL RLS for defense in depth

**Cons:**
- Risk of forgetting `.where({ tenant_id })` in a query → data leak
- Indexes need updating (all tenant_id combos)
- `portal_settings` needs rethinking (currently global)

### Option B: Schema-Per-Tenant (`search_path`)

Each tenant gets a PostgreSQL schema (`tenant_abc`, `tenant_xyz`). Set `search_path` at connection time.

**Pros:**
- Complete data isolation
- Can drop/dump a tenant cleanly (`DROP SCHEMA tenant_abc CASCADE`)
- No risk of cross-tenant query leaks

**Cons:**
- Knex migration system not built for this — requires running migrations per schema
- Connection pooling nightmare: can't share a pool across tenants without `SET search_path` per query
- `fee_lambda` shared reference data must live in `public` schema → query gets complex
- Harder to do cross-tenant queries (usage analytics, etc.)

### Recommendation: Option A (`tenant_id`) + PostgreSQL RLS

Row-level `tenant_id` is the pragmatic choice for a Knex/Node.js stack. Add PostgreSQL RLS as a safety net to catch bugs, not as the primary mechanism.

---

## 3. Row-Level Security (RLS)

PostgreSQL RLS **can** be added to all tenant-sensitive tables. The recommended approach:

1. Create a session variable: `SET app.current_tenant_id = '<uuid>'`
2. Set this at query/transaction start (via Knex `afterCreate` hook on the pool)
3. Write RLS policies using `current_setting('app.current_tenant_id')`

**Example:**
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Caveat:** RLS with Knex requires a superuser bypass role for migrations and admin operations. Use `BYPASSRLS` role for the migration user.

---

## 4. Migration Strategy

### Phase 0: Add Tenants Table
```js
// 007_tenants.js
export async function up(knex) {
  await knex.schema.createTable('tenants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('slug', 63).unique().notNullable(); // e.g. 'forma-arch'
    t.string('name', 255).notNullable();
    t.string('plan', 30).defaultTo('starter'); // starter | pro | enterprise
    t.boolean('active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
  
  // Seed the existing single tenant (Forma Architecture)
  await knex('tenants').insert({
    slug: 'forma-arch',
    name: 'ΜΠΟΥΡΑΣ ΠΑΠΑΔΕΑΣ Ι.Κ.Ε.',
    plan: 'pro',
    active: true,
  });
}
```

### Phase 1: Add `tenant_id` to All Tables
```js
// 008_add_tenant_id.js
export async function up(knex) {
  // Get the seed tenant ID
  const [tenant] = await knex('tenants').where({ slug: 'forma-arch' }).select('id');
  const tenantId = tenant.id;

  const tenantTables = [
    'users', 'clients', 'projects', 'fee_calculations',
    'portal_projects', 'portal_templates', 'portal_settings',
    'portal_activity_log',
  ];
  // Child tables (cascade via FK) don't strictly need tenant_id,
  // but adding it allows direct queries without joins.
  // Properties, ekdosi, documents, approvals, etc. reach tenant via project_id.
  // For RLS safety, add to all direct-access tables.

  for (const table of tenantTables) {
    await knex.schema.alterTable(table, (t) => {
      t.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    });
    // Backfill existing data to the seed tenant
    await knex(table).update({ tenant_id: tenantId });
    // Now make it NOT NULL
    await knex.schema.alterTable(table, (t) => {
      t.uuid('tenant_id').notNullable().alter();
    });
  }

  // Add tenant_id indexes
  for (const table of tenantTables) {
    await knex.schema.raw(`CREATE INDEX idx_${table}_tenant ON ${table}(tenant_id)`);
  }

  // portal_settings: migrate from global to per-tenant
  // (Already backfilled above — the existing keys become forma-arch settings)
}

export async function down(knex) {
  const tenantTables = [
    'users', 'clients', 'projects', 'fee_calculations',
    'portal_projects', 'portal_templates', 'portal_settings',
    'portal_activity_log',
  ];
  for (const table of tenantTables) {
    await knex.schema.alterTable(table, (t) => t.dropColumn('tenant_id'));
  }
  await knex.schema.dropTableIfExists('tenants');
}
```

### Phase 2: Add RLS Policies
```js
// 009_enable_rls.js
export async function up(knex) {
  const tenantTables = [
    'users', 'clients', 'projects', 'fee_calculations',
    'portal_projects', 'portal_templates', 'portal_settings',
  ];

  for (const table of tenantTables) {
    await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`
      CREATE POLICY tenant_isolation ON ${table}
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    `);
    // Allow bypass for migrations/admin
    await knex.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  }
}
```

---

## 5. Example Updated Query Patterns

### Middleware: Inject Tenant Context

```js
// src/middleware/tenant.js
export async function tenantMiddleware(req, reply) {
  // Resolve tenant from JWT claim or subdomain
  const tenantId = req.user?.tenant_id || resolveTenantFromHost(req.hostname);
  if (!tenantId) return reply.code(401).send({ error: 'Tenant not identified' });
  req.tenantId = tenantId;
}
```

### Knex Hook: Set RLS Session Variable

```js
// src/config/database.js
const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL || { ... },
  pool: {
    min: 2,
    max: 20, // increase for SaaS
    afterCreate(conn, done) {
      // Optional: set default — overridden per-request
      done(null, conn);
    },
  },
});

// Per-request: wrap queries in a transaction with SET
export async function withTenant(tenantId, callback) {
  return db.transaction(async (trx) => {
    await trx.raw(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return callback(trx);
  });
}
```

### Updated Route Example

```js
// BEFORE
fastify.get('/', async (req, reply) => {
  const rows = await db('projects').where('deleted', false)...
});

// AFTER
fastify.get('/', { preHandler: [fastify.authenticate, tenantMiddleware] }, async (req, reply) => {
  const rows = await db('projects')
    .where({ tenant_id: req.tenantId, deleted: false })
    ...
});
```

### Fix: XML Route N+1 → `Promise.all`

```js
// BEFORE: 7 sequential awaits
const project = await db('projects').where({ id }).first();
const property = await db('properties').where({ project_id: id }).first();
// ... etc

// AFTER: parallel
const [project, property, ekdosi, docRights, approvals, prevPraxis] = await Promise.all([
  db('projects').where({ id: req.params.id }).first(),
  db('properties').where({ project_id: req.params.id }).first(),
  db('ekdosi').where({ project_id: req.params.id }).first(),
  db('doc_rights').where({ project_id: req.params.id }),
  db('approvals').where({ project_id: req.params.id }),
  db('prev_praxis').where({ project_id: req.params.id }),
]);
```

### Fix: Portal Form Submit → Upsert

```js
// BEFORE: N select + insert/update loop
for (const [field_name, field_value] of Object.entries(formData)) {
  const existing = await db('portal_form_data').where({ step_id, field_name }).first();
  if (existing) { await db(...).update(...); } else { await db(...).insert(...); }
}

// AFTER: single batch upsert
const rows = Object.entries(formData).map(([field_name, field_value]) => ({
  step_id: step.id,
  field_name,
  field_value: String(field_value),
}));
await db('portal_form_data')
  .insert(rows)
  .onConflict(['step_id', 'field_name'])
  .merge(['field_value']);
```

---

## 6. Connection Pooling for SaaS

Current config: `min: 2, max: 10` — fine for a single-user install.

For multi-tenant SaaS:
- Each concurrent request holds a connection during its query
- With 50 active tenants, peak concurrent DB requests could easily exceed 10
- RLS `SET LOCAL` requires transactions, which hold connections longer

**Recommended:**
```js
pool: {
  min: 5,
  max: 50,          // adjust based on PostgreSQL max_connections
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  idleTimeoutMillis: 600000,
  reapIntervalMillis: 1000,
}
```

**Also:** Consider [PgBouncer](https://www.pgbouncer.org/) in transaction mode in front of PostgreSQL for connection multiplexing at scale. Note: RLS `SET LOCAL` works in transaction mode, but `SET` (session-level) does not — use `SET LOCAL` in transactions only.

---

## 7. `portal_settings` Special Case

Currently a global key-value table with one engineer's personal data hardcoded as migration seed. In multi-tenant:

1. Add `tenant_id` column (Phase 1 handles this)
2. The key constraint becomes `UNIQUE(tenant_id, key)`
3. Default settings seeded per-tenant at onboarding
4. Consider a `tenants` table with a `settings JSONB` column instead for simplicity

---

## 8. Priority Ranking

| Priority | Task | Effort | Risk |
|---|---|---|---|
| 🔴 P0 | Add `tenants` table + seed existing tenant | 1 day | Low |
| 🔴 P0 | Add `tenant_id` to all tables + backfill | 1–2 days | Medium |
| 🔴 P0 | Update all routes to filter by `tenant_id` | 2–3 days | High (must not miss any) |
| 🟠 P1 | Add composite indexes `(tenant_id, ...)` | 0.5 days | Low |
| 🟠 P1 | Increase pool size + add PgBouncer | 0.5 days | Low |
| 🟠 P1 | Fix XML route N+1 → `Promise.all` | 2 hours | Low |
| 🟡 P2 | Add PostgreSQL RLS as defense-in-depth | 1 day | Medium |
| 🟡 P2 | Fix portal form submit → batch upsert | 2 hours | Low |
| 🟡 P2 | Tenant-aware `portal_settings` refactor | 0.5 days | Low |
| 🟢 P3 | Add `withTenant()` transaction helper for RLS session vars | 1 day | Low |
| 🟢 P3 | Tenant subdomain/JWT routing middleware | 1 day | Medium |

---

## 9. Summary

OpenAdeia is a well-structured single-tenant app. The migration to multi-tenancy is **feasible without major rewrites**:

- **Schema:** Clean FK structure, UUID primary keys, no global sequences that would conflict across tenants
- **Knex:** Easy to add `.where({ tenant_id })` to all queries
- **Risk:** The main failure mode is a missed `tenant_id` filter somewhere causing data leakage. PostgreSQL RLS is the safety net for this.
- **Quick win:** The XML route N+1 fix is a free performance improvement, do it regardless of SaaS plans.
- **Avoid schema-per-tenant** — the Knex migration system and connection pooling make it much harder to operate.

The recommended path: **P0 items first** (adds tenant_id without breaking anything), then systematically update routes, then add RLS as insurance.
