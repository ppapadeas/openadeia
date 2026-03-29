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
  const existing = await knex('users').where({ email: 'pierros@papadeas.gr' }).first();

  if (!existing) {
    // Use a secure default password — must be changed on first login
    const password_hash = await bcrypt.hash('ChangeMe2026!', 12);
    await knex('users').insert({
      email: 'pierros@papadeas.gr',
      name: 'Pierros Papadeas',
      role: 'admin',
      is_superadmin: true,
      password_hash,
    });
    console.log('[007_superadmin] Created superadmin user: pierros@papadeas.gr');
  } else {
    // Elevate existing user to superadmin
    await knex('users').where({ email: 'pierros@papadeas.gr' }).update({ is_superadmin: true });
    console.log('[007_superadmin] Elevated pierros@papadeas.gr to superadmin');
  }
}

export async function down(knex) {
  await knex('users').where({ email: 'pierros@papadeas.gr' }).update({ is_superadmin: false });

  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('is_superadmin');
  });
}
