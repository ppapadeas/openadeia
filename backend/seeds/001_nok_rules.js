/**
 * Seed: NOK Rules are loaded from config/nok-rules.json at runtime.
 * This seed inserts a default admin user for development.
 */
export async function seed(knex) {
  // Upsert dev admin user
  await knex('users').insert({
    email: 'admin@eadeies.local',
    name: 'Admin User',
    role: 'admin',
  }).onConflict('email').ignore();
}
