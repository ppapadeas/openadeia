/**
 * Migration 008 — Multi-Tenancy Foundation
 *
 * Creates the `tenants` table and adds `tenant_id` to all tenant-scoped tables.
 * Migrates existing portal_settings data into the first tenant (forma-architecture).
 *
 * Strategy:
 *  1. Create tenants table
 *  2. Seed first tenant from portal_settings
 *  3. Add tenant_id (NULLABLE) to all tables
 *  4. Backfill tenant_id on all existing rows
 *  5. Make tenant_id NOT NULL
 *  6. Add indexes
 */

export async function up(knex) {
  // ── 1. Create tenants table ──────────────────────────────────────────
  await knex.schema.createTable('tenants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('slug', 63).unique().notNullable();
    t.string('name', 255).notNullable();
    t.string('plan', 20).notNullable().defaultTo('self_hosted')
      .checkIn(['free', 'pro', 'enterprise', 'self_hosted']);
    t.string('status', 20).notNullable().defaultTo('active')
      .checkIn(['trialing', 'active', 'past_due', 'canceled', 'suspended']);

    // Stripe (SaaS)
    t.string('stripe_customer_id', 100).nullable();
    t.string('stripe_subscription_id', 100).nullable();
    t.timestamp('trial_ends_at').nullable();
    t.timestamp('current_period_end').nullable();

    // Settings (replaces portal_settings for multi-tenant)
    t.jsonb('settings').notNullable().defaultTo('{}');

    // Limits (per-plan, can be overridden)
    t.jsonb('limits').notNullable().defaultTo(
      JSON.stringify({ projects_max: -1, storage_max_bytes: -1, team_max: -1 })
    );

    // Usage counters
    t.jsonb('usage').notNullable().defaultTo(
      JSON.stringify({ projects_count: 0, storage_bytes: 0, team_count: 0 })
    );

    t.timestamps(true, true);
  });

  // ── 2. Seed first tenant from portal_settings ────────────────────────
  const settings = await knex('portal_settings').select('key', 'value');
  const settingsMap = Object.fromEntries(settings.map(r => [r.key, r.value]));

  const [defaultTenant] = await knex('tenants').insert({
    slug: 'forma-architecture',
    name: settingsMap.company_name || 'Forma Architecture',
    plan: 'self_hosted',
    status: 'active',
    settings: JSON.stringify({
      engineer_name: settingsMap.engineer_name || null,
      engineer_am: settingsMap.engineer_am || null,
      engineer_address: settingsMap.engineer_address || null,
      engineer_afm: settingsMap.engineer_afm || null,
      engineer_phone: settingsMap.engineer_phone || null,
      engineer_email: settingsMap.engineer_email || null,
      company_name: settingsMap.company_name || null,
      company_afm: settingsMap.company_afm || null,
      company_iban: settingsMap.company_iban || null,
      base_url: settingsMap.base_url || null,
      smtp_host: settingsMap.smtp_host || null,
      smtp_port: settingsMap.smtp_port || null,
      smtp_user: settingsMap.smtp_user || null,
      smtp_pass: settingsMap.smtp_pass || null,
      smtp_from: settingsMap.smtp_from || null,
      smtp_name: settingsMap.smtp_name || null,
    }),
    limits: JSON.stringify({
      projects_max: -1,
      storage_max_bytes: -1,
      team_max: -1,
    }),
    usage: JSON.stringify({
      projects_count: 0,
      storage_bytes: 0,
      team_count: 0,
    }),
  }).returning('id');

  const tenantId = defaultTenant.id;
  console.log(`[008_multitenancy] Created default tenant: forma-architecture (${tenantId})`);

  // ── 3 + 4 + 5. Add tenant_id, backfill, make NOT NULL ───────────────
  const tenantTables = [
    'users',
    'projects',
    'clients',
    'documents',
    'fee_calculations',
    'emails',
    'workflow_logs',
  ];

  for (const table of tenantTables) {
    // Check if table exists (some may not exist yet)
    const exists = await knex.schema.hasTable(table);
    if (!exists) {
      console.log(`[008_multitenancy] Skipping ${table} — table does not exist`);
      continue;
    }

    // Add nullable tenant_id with FK
    await knex.schema.alterTable(table, (t) => {
      t.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('CASCADE');
    });

    // Backfill all existing rows
    const updated = await knex(table).update({ tenant_id: tenantId });
    console.log(`[008_multitenancy] Backfilled ${updated} rows in ${table}`);

    // Make NOT NULL
    await knex.schema.alterTable(table, (t) => {
      t.uuid('tenant_id').notNullable().alter();
    });
  }

  // ── 6. Create indexes ───────────────────────────────────────────────
  for (const table of tenantTables) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;
    await knex.schema.raw(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id ON ${table}(tenant_id)`);
  }

  // Also add composite index on tenants.slug for tenant resolution
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL');

  console.log('[008_multitenancy] Migration complete');
}

export async function down(knex) {
  const tenantTables = [
    'users',
    'projects',
    'clients',
    'documents',
    'fee_calculations',
    'emails',
    'workflow_logs',
  ];

  for (const table of tenantTables) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;

    const hasTenantId = await knex.schema.hasColumn(table, 'tenant_id');
    if (hasTenantId) {
      await knex.schema.alterTable(table, (t) => {
        t.dropColumn('tenant_id');
      });
    }
  }

  await knex.schema.dropTableIfExists('tenants');
}
