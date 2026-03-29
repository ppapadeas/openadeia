/**
 * Seed: NOK Rules are loaded from config/nok-rules.json at runtime.
 * This seed inserts a default admin user for development.
 */
export async function seed(knex) {
  // Ensure a default tenant exists
  const [tenant] = await knex('tenants').insert({
    slug: 'dev-default',
    name: 'Development Tenant',
    plan: 'self_hosted',
    status: 'active',
  }).onConflict('slug').merge().returning('*');

  // Upsert dev admin user
  await knex('users').insert({
    email: 'admin@eadeies.local',
    name: 'Admin User',
    role: 'admin',
    tenant_id: tenant.id,
  }).onConflict('email').ignore();
}
