/**
 * Migration 006 — Client Portal
 * Adds tables for forma-onboarding-service integration.
 * Token-based client access portal linked to OpenAdeia projects.
 */

export async function up(knex) {
  // ── portal_projects ─────────────────────────────────────────────────
  await knex.schema.createTable('portal_projects', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.string('token', 36).notNullable().unique();
    t.string('status', 20).notNullable().defaultTo('draft'); // draft | active | completed
    t.text('client_message').defaultTo('');
    t.string('language', 5).notNullable().defaultTo('el'); // el | en
    t.integer('owners_count').notNullable().defaultTo(1);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.unique(['project_id']); // One portal per project
  });

  // ── portal_steps ────────────────────────────────────────────────────
  await knex.schema.createTable('portal_steps', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('portal_project_id').notNullable().references('id').inTable('portal_projects').onDelete('CASCADE');
    t.string('type', 20).notNullable(); // upload | form | sign | pay
    t.string('title', 255).notNullable();
    t.text('description');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('required').notNullable().defaultTo(true);
    t.boolean('review_required').notNullable().defaultTo(false);
    t.string('status', 20).notNullable().defaultTo('available'); // locked | available | submitted | in_review | revision | done | skipped
    t.jsonb('config').notNullable().defaultTo('{}');
    t.specificType('depends_on', 'UUID[]').defaultTo('{}');
    t.text('admin_comment');
    t.timestamp('submitted_at');
    t.timestamp('reviewed_at');
    t.timestamp('completed_at');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── portal_form_data ────────────────────────────────────────────────
  await knex.schema.createTable('portal_form_data', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('step_id').notNullable().references('id').inTable('portal_steps').onDelete('CASCADE');
    t.string('field_name', 100).notNullable();
    t.text('field_value');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['step_id', 'field_name']);
  });

  // ── portal_files ────────────────────────────────────────────────────
  await knex.schema.createTable('portal_files', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('step_id').notNullable().references('id').inTable('portal_steps').onDelete('CASCADE');
    t.string('original_name', 255).notNullable();
    t.string('minio_path', 500).notNullable();
    t.string('mime_type', 100);
    t.bigInteger('size_bytes');
    t.timestamp('uploaded_at').defaultTo(knex.fn.now());
  });

  // ── portal_templates ────────────────────────────────────────────────
  await knex.schema.createTable('portal_templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('original_name', 255).notNullable();
    t.string('minio_path', 500).notNullable();
    t.string('mime_type', 100);
    t.jsonb('placeholders').defaultTo('[]');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── portal_generated_docs ───────────────────────────────────────────
  await knex.schema.createTable('portal_generated_docs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('step_id').notNullable().references('id').inTable('portal_steps').onDelete('CASCADE');
    t.uuid('template_id').references('id').inTable('portal_templates');
    t.string('minio_path', 500).notNullable();
    t.text('signature_data');
    t.timestamp('signed_at');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── portal_project_engineers ────────────────────────────────────────
  await knex.schema.createTable('portal_project_engineers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('portal_project_id').notNullable().references('id').inTable('portal_projects').onDelete('CASCADE');
    t.string('role', 100).notNullable().defaultTo('');
    t.string('surname', 100).notNullable();
    t.string('name', 100).notNullable();
    t.string('am', 20);
    t.string('specialty', 100);
  });

  // ── portal_settings ─────────────────────────────────────────────────
  await knex.schema.createTable('portal_settings', (t) => {
    t.string('key', 100).primary();
    t.text('value').notNullable();
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // ── portal_activity_log ─────────────────────────────────────────────
  await knex.schema.createTable('portal_activity_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('portal_project_id').references('id').inTable('portal_projects').onDelete('CASCADE');
    t.uuid('step_id').references('id').inTable('portal_steps').onDelete('SET NULL');
    t.string('action', 100).notNullable();
    t.string('actor', 50).notNullable().defaultTo('system'); // client | admin | system
    t.text('details');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── Indexes ─────────────────────────────────────────────────────────
  await knex.raw('CREATE INDEX idx_portal_projects_token ON portal_projects(token)');
  await knex.raw('CREATE INDEX idx_portal_projects_status ON portal_projects(status)');
  await knex.raw('CREATE INDEX idx_portal_steps_portal ON portal_steps(portal_project_id)');
  await knex.raw('CREATE INDEX idx_portal_steps_status ON portal_steps(status)');
  await knex.raw('CREATE INDEX idx_portal_form_data_step ON portal_form_data(step_id)');
  await knex.raw('CREATE INDEX idx_portal_files_step ON portal_files(step_id)');
  await knex.raw('CREATE INDEX idx_portal_docs_step ON portal_generated_docs(step_id)');
  await knex.raw('CREATE INDEX idx_portal_engineers_portal ON portal_project_engineers(portal_project_id)');
  await knex.raw('CREATE INDEX idx_portal_log_project ON portal_activity_log(portal_project_id)');
  await knex.raw('CREATE INDEX idx_portal_log_created ON portal_activity_log(created_at)');

  // ── Default settings ─────────────────────────────────────────────────
  await knex('portal_settings').insert([
    { key: 'engineer_name', value: 'Πιέρρος Παπαδέας' },
    { key: 'engineer_am', value: '163860' },
    { key: 'engineer_address', value: 'Δαμοφώντος 5, Καλαμάτα 24131' },
    { key: 'engineer_afm', value: '' },
    { key: 'engineer_phone', value: '+30 6976618095' },
    { key: 'engineer_email', value: 'pierros@papadeas.gr' },
    { key: 'company_name', value: 'ΜΠΟΥΡΑΣ ΠΑΠΑΔΕΑΣ Ι.Κ.Ε.' },
    { key: 'company_afm', value: '803187598' },
    { key: 'company_iban', value: '' },
    { key: 'base_url', value: 'https://openadeia.forma-arch.gr' },
    { key: 'email_from', value: 'Forma Architecture <info@forma-arch.gr>' },
  ]);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('portal_activity_log');
  await knex.schema.dropTableIfExists('portal_settings');
  await knex.schema.dropTableIfExists('portal_project_engineers');
  await knex.schema.dropTableIfExists('portal_generated_docs');
  await knex.schema.dropTableIfExists('portal_templates');
  await knex.schema.dropTableIfExists('portal_files');
  await knex.schema.dropTableIfExists('portal_form_data');
  await knex.schema.dropTableIfExists('portal_steps');
  await knex.schema.dropTableIfExists('portal_projects');
}
