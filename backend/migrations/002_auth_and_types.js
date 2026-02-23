/**
 * Migration 002 — Auth fields + corrected permit type model
 *
 * Changes:
 *  - users: add password_hash, tee_username, tee_password_enc
 *  - projects: add is_continuation boolean
 *  - projects: migrate legacy type values (cat1→minor_cat1, cat2→new_building, cat3→new_building)
 */

export async function up(knex) {
  // ── users: auth + TEE credentials ─────────────────────────────────
  await knex.schema.alterTable('users', (t) => {
    t.string('password_hash', 255);
    // TEE e-Adeies portal credentials (password stored AES-256 encrypted)
    t.string('tee_username', 100);
    t.text('tee_password_enc');
  });

  // ── projects: add is_continuation flag ────────────────────────────
  await knex.schema.alterTable('projects', (t) => {
    t.boolean('is_continuation').notNullable().defaultTo(false);
  });

  // ── projects: migrate legacy type values to correct names ─────────
  // old: cat1 → minor_cat1  (Έγκριση Εργασιών Κατ.1)
  // old: cat2 → new_building (Νέα Οικοδομική Άδεια)
  // old: cat3 → new_building (also maps to new building, large scale)
  // old: vod  → vod          (unchanged)
  await knex('projects').where('type', 'cat1').update({ type: 'minor_cat1' });
  await knex('projects').where('type', 'cat2').update({ type: 'new_building' });
  await knex('projects').where('type', 'cat3').update({ type: 'new_building' });
}

export async function down(knex) {
  // Revert type migration
  await knex('projects').where('type', 'minor_cat1').update({ type: 'cat1' });
  await knex('projects').where('type', 'new_building').update({ type: 'cat2' });

  await knex.schema.alterTable('projects', (t) => {
    t.dropColumn('is_continuation');
  });

  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('password_hash');
    t.dropColumn('tee_username');
    t.dropColumn('tee_password_enc');
  });
}
