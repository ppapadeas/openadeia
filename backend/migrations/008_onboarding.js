/**
 * Migration 008 — Onboarding & Multi-Tenancy Foundation
 *
 * Changes:
 *  - Create tenants table (SaaS multi-tenancy basis)
 *  - users: add tenant_id, email_verified_at, email_verify_token,
 *           password_reset_token, password_reset_expires
 *  - clients: add tenant_id
 *  - projects: add tenant_id
 *  - workflow_logs: add tenant_id
 *
 * NOTE: tenant_id is nullable for backward compat with existing single-tenant data.
 * Phase 1 migration will backfill and enforce NOT NULL.
 */

export async function up(knex) {
  // ── tenants — create only if 008_multitenancy didn't already run ──
  const hasTenantsTable = await knex.schema.hasTable('tenants');
  if (!hasTenantsTable) {
    await knex.schema.createTable('tenants', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('slug', 63).unique().notNullable();
      t.string('name', 255).notNullable();
      t.string('plan', 20).notNullable().defaultTo('free')
        .checkIn(['free', 'pro', 'enterprise', 'self_hosted']);
      t.string('status', 20).notNullable().defaultTo('trialing')
        .checkIn(['trialing', 'active', 'past_due', 'canceled', 'suspended']);

      // Stripe (populated on billing setup)
      t.string('stripe_customer_id', 100).nullable();
      t.string('stripe_subscription_id', 100).nullable();
      t.timestamp('trial_ends_at').nullable();
      t.timestamp('current_period_end').nullable();

      // Per-tenant settings (replaces portal_settings in full v2)
      t.jsonb('settings').notNullable().defaultTo('{}');

      // Plan limits (overrideable)
      t.jsonb('limits').notNullable().defaultTo(
        JSON.stringify({ projects_max: 5, storage_max_bytes: 524288000, team_max: 1 })
      );

      // Cached usage counters
      t.jsonb('usage').notNullable().defaultTo(
        JSON.stringify({ projects_count: 0, storage_bytes: 0, team_count: 0 })
      );

      t.timestamps(true, true);
    });

    await knex.raw('CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_tenants_stripe ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL');
  }

  // ── users: tenant_id + auth token fields (idempotent) ─────────────
  const hasTenantIdOnUsers = await knex.schema.hasColumn('users', 'tenant_id');
  if (!hasTenantIdOnUsers) {
    await knex.schema.alterTable('users', (t) => {
      t.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('CASCADE');
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)');
  }

  const hasEmailVerifiedAt = await knex.schema.hasColumn('users', 'email_verified_at');
  if (!hasEmailVerifiedAt) {
    await knex.schema.alterTable('users', (t) => {
      t.timestamp('email_verified_at').nullable();
      t.string('email_verify_token', 100).nullable();
      t.string('password_reset_token', 100).nullable();
      t.timestamp('password_reset_expires').nullable();
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_email_verify ON users(email_verify_token) WHERE email_verify_token IS NOT NULL');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_pwd_reset ON users(password_reset_token) WHERE password_reset_token IS NOT NULL');
  }

  // ── clients: tenant_id ─────────────────────────────────────────────
  const hasTenantIdOnClients = await knex.schema.hasColumn('clients', 'tenant_id');
  if (!hasTenantIdOnClients) {
    await knex.schema.alterTable('clients', (t) => {
      t.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('CASCADE');
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id)');
  }

  // ── projects: tenant_id ────────────────────────────────────────────
  const hasTenantIdOnProjects = await knex.schema.hasColumn('projects', 'tenant_id');
  if (!hasTenantIdOnProjects) {
    await knex.schema.alterTable('projects', (t) => {
      t.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('CASCADE');
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id, deleted)');
  }

  // ── workflow_logs: tenant_id ───────────────────────────────────────
  const hasTenantIdOnWfl = await knex.schema.hasColumn('workflow_logs', 'tenant_id');
  if (!hasTenantIdOnWfl) {
    await knex.schema.alterTable('workflow_logs', (t) => {
      t.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('CASCADE');
    });
  }
}

export async function down(knex) {
  // Remove added columns
  for (const table of ['workflow_logs', 'projects', 'clients']) {
    await knex.schema.alterTable(table, (t) => t.dropColumn('tenant_id'));
  }

  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('tenant_id');
    t.dropColumn('email_verified_at');
    t.dropColumn('email_verify_token');
    t.dropColumn('password_reset_token');
    t.dropColumn('password_reset_expires');
  });

  await knex.schema.dropTableIfExists('tenants');
}
