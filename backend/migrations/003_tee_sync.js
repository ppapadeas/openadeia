/**
 * Migration 003 — TEE sync support
 * - projects: add tee_sync_at (last sync timestamp), tee_raw (raw TEE API response)
 * - workflow_logs: metadata already jsonb, nothing new needed
 */

export async function up(knex) {
  await knex.schema.alterTable('projects', (t) => {
    t.timestamp('tee_sync_at');
    t.jsonb('tee_raw');  // raw TEE API response snapshot
  });
}

export async function down(knex) {
  await knex.schema.alterTable('projects', (t) => {
    t.dropColumn('tee_sync_at');
    t.dropColumn('tee_raw');
  });
}
