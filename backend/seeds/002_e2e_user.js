/**
 * Seed: E2E test user for Playwright tests.
 * Only runs when E2E_SEED=true (set in CI).
 */
import bcrypt from 'bcryptjs';

export async function seed(knex) {
  if (process.env.E2E_SEED !== 'true') return;

  const email = 'e2e@openadeia.test';
  const password = 'e2e-test-password';
  const password_hash = await bcrypt.hash(password, 12);

  // Ensure a tenant exists
  const [tenant] = await knex('tenants').insert({
    slug: 'e2e-test',
    name: 'E2E Test Tenant',
    plan: 'self_hosted',
    status: 'active',
  }).onConflict('slug').merge().returning('*');

  // Upsert E2E user
  await knex('users').insert({
    email,
    name: 'E2E Test User',
    role: 'admin',
    password_hash,
    tenant_id: tenant.id,
    is_superadmin: true,
  }).onConflict('email').merge();
}
