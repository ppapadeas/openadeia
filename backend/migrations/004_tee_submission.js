export function up(knex) {
  return knex.schema.alterTable('projects', (t) => {
    t.timestamp('tee_submitted_at');
    t.string('tee_submission_ref', 128);
  });
}

export function down(knex) {
  return knex.schema.alterTable('projects', (t) => {
    t.dropColumn('tee_submitted_at');
    t.dropColumn('tee_submission_ref');
  });
}
