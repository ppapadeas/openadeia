/**
 * Migration 008 — Audit Log & GDPR Compliance
 *
 * Creates the audit_log table for tracking all state-changing operations.
 *
 * Note on tenant_id: The tenants table does not yet exist in Phase 6 (single-tenant).
 * We store tenant_id as a nullable UUID without a FK constraint for now.
 * When the tenants table is added (Phase 4 multi-tenancy), add:
 *   ALTER TABLE audit_log ADD CONSTRAINT fk_audit_tenant
 *     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
 *
 * actor_type values: user | portal_client | system | api
 */

export async function up(knex) {
  await knex.schema.createTable('audit_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // tenant_id: nullable UUID — no FK yet (tenants table not created until Phase 4)
    t.uuid('tenant_id').nullable();
    t.string('actor_type', 20).notNullable(); // user | portal_client | system | api
    t.string('actor_id', 100).nullable();
    t.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('action', 100).notNullable();
    t.string('resource_type', 50).nullable();
    t.uuid('resource_id').nullable();
    t.jsonb('metadata').nullable();
    t.specificType('ip_address', 'INET').nullable();
    t.text('user_agent').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(
    'CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at DESC)'
  );

  // Additional useful indexes
  await knex.raw(
    'CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC)'
  );
  await knex.raw(
    'CREATE INDEX idx_audit_action ON audit_log(action, created_at DESC)'
  );
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('audit_log');
}
