/**
 * Migration 007 — Superadmin support
 *
 * Changes:
 *  - users: add is_superadmin BOOLEAN DEFAULT false
 *  - Create first superadmin user: pierros@papadeas.gr (if not exists)
 *
 * Note: `is_superadmin` is a PLATFORM-LEVEL flag, separate from per-tenant `role`.
 * A superadmin can access /api/admin/* endpoints and manage all tenants.
 */

import bcrypt from 'bcryptjs';

export async function up(knex) {
  // ── Add is_superadmin to users ────────────────────────────────────
  await knex.schema.alterTable('users', (t) => {
    t.boolean('is_superadmin').notNullable().defaultTo(false);
  });

  // ── Create first superadmin user if not exists ───────────────────
  const superadminEmail = process.env.SUPERADMIN_EMAIL || 'admin@openadeia.gr';

  const existing = await knex('users').where({ email: superadminEmail }).first();

  if (!existing) {
    // Use a secure default password — must be changed on first login
    const password_hash = await bcrypt.hash('ChangeMe2026!', 12);
    await knex('users').insert({
      email: superadminEmail,
      name: 'Platform Admin',
      role: 'admin',
      is_superadmin: true,
      password_hash,
    });
    console.log(`[007_superadmin] Created superadmin user: ${superadminEmail}`);
  } else {
    // Elevate existing user to superadmin
    await knex('users').where({ email: superadminEmail }).update({ is_superadmin: true });
    console.log(`[007_superadmin] Elevated ${superadminEmail} to superadmin`);
  }
}

export async function down(knex) {
  const superadminEmail = process.env.SUPERADMIN_EMAIL || 'admin@openadeia.gr';

  await knex('users').where({ email: superadminEmail }).update({ is_superadmin: false });

  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('is_superadmin');
  });
}
