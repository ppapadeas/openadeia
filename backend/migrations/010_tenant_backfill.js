/**
 * Migration 010 — Tenant Backfill & NOT NULL enforcement
 *
 * 008_onboarding.js added tenant_id columns as nullable.
 * This migration:
 *  1. Creates the default tenant from portal_settings data
 *  2. Backfills tenant_id on all existing rows
 *  3. Makes tenant_id NOT NULL on all tables
 *  4. Adds missing indexes
 *  5. Adds tenant_id to documents, fee_calculations, emails (missed in 008)
 */

export async function up(knex) {
  // ── 1. Seed default tenant ─────────────────────────────────────────
  let tenantId;
  const existingTenant = await knex('tenants').where({ slug: 'forma-architecture' }).first();

  if (!existingTenant) {
    const settingsRows = await knex('portal_settings').select('key', 'value').catch(() => []);
    const settingsMap = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));

    const [newTenant] = await knex('tenants').insert({
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
      limits: JSON.stringify({ projects_max: -1, storage_max_bytes: -1, team_max: -1 }),
      usage: JSON.stringify({ projects_count: 0, storage_bytes: 0, team_count: 0 }),
    }).returning('id');
    tenantId = newTenant.id;
    console.log(`[010_tenant_backfill] Created default tenant: forma-architecture (${tenantId})`);
  } else {
    tenantId = existingTenant.id;
    console.log(`[010_tenant_backfill] Using existing tenant: forma-architecture (${tenantId})`);
  }

  // ── 2. Add tenant_id to tables that 008 missed ─────────────────────
  const missingTables = ['documents', 'fee_calculations', 'emails'];
  for (const table of missingTables) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;

    const hasTenantId = await knex.schema.hasColumn(table, 'tenant_id');
    if (!hasTenantId) {
      await knex.schema.alterTable(table, (t) => {
        t.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('CASCADE');
      });
      console.log(`[010_tenant_backfill] Added tenant_id to ${table}`);
    }
  }

  // ── 3. Backfill all tables ─────────────────────────────────────────
  const allTables = ['users', 'clients', 'projects', 'documents', 'fee_calculations', 'emails', 'workflow_logs'];
  for (const table of allTables) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;

    const updated = await knex(table).whereNull('tenant_id').update({ tenant_id: tenantId });
    if (updated > 0) {
      console.log(`[010_tenant_backfill] Backfilled ${updated} rows in ${table}`);
    }
  }

  // ── 4. Enforce NOT NULL on all tenant_id columns ───────────────────
  for (const table of allTables) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;

    // Check if any nulls remain
    const [{ count }] = await knex(table).whereNull('tenant_id').count('* as count');
    if (Number(count) > 0) {
      console.warn(`[010_tenant_backfill] WARNING: ${count} rows in ${table} still have NULL tenant_id — skipping NOT NULL for safety`);
      continue;
    }

    await knex.schema.alterTable(table, (t) => {
      t.uuid('tenant_id').notNullable().alter();
    });
    console.log(`[010_tenant_backfill] ${table}: tenant_id is now NOT NULL`);
  }

  // ── 5. Add indexes ─────────────────────────────────────────────────
  const indexDefs = [
    { table: 'documents', index: 'idx_documents_tenant' },
    { table: 'fee_calculations', index: 'idx_fee_calculations_tenant' },
    { table: 'emails', index: 'idx_emails_tenant' },
    // Ensure these exist even if 008 skipped them
    { table: 'clients', index: 'idx_clients_tenant' },
    { table: 'projects', index: 'idx_projects_tenant' },
    { table: 'workflow_logs', index: 'idx_workflow_logs_tenant' },
  ];

  for (const { table, index } of indexDefs) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;
    await knex.raw(`CREATE INDEX IF NOT EXISTS ${index} ON ${table}(tenant_id)`);
  }

  console.log('[010_tenant_backfill] Migration complete');
}

export async function down(knex) {
  // Only remove tenant from tables added in THIS migration (documents, fee_calculations, emails)
  for (const table of ['documents', 'fee_calculations', 'emails']) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;
    const hasTenantId = await knex.schema.hasColumn(table, 'tenant_id');
    if (hasTenantId) {
      await knex.schema.alterTable(table, (t) => t.dropColumn('tenant_id'));
    }
  }

  // Nullify tenant_id on other tables (don't drop — 008 owns those)
  for (const table of ['users', 'clients', 'projects', 'workflow_logs']) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;
    await knex.schema.alterTable(table, (t) => {
      t.uuid('tenant_id').nullable().alter();
    });
    await knex(table).update({ tenant_id: null });
  }

  // Drop the default tenant
  await knex('tenants').where({ slug: 'forma-architecture' }).delete();
}
