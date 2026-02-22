/**
 * Initial schema migration
 * Derived from AdeiaAitisiInput.xsd field mapping + app requirements
 */

export async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "postgis"');

  // ── users ──────────────────────────────────────────────────────────
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('email', 255).unique().notNullable();
    t.string('name', 255).notNullable();
    // engineer | admin | viewer
    t.string('role', 30).notNullable().defaultTo('engineer');
    // TEE member number (AMH from XSD AITISI_ENGINEER_TYPE)
    t.integer('amh').unique();
    t.string('keycloak_id', 255);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── clients (property owners, maps to AITISI_OWNER_TYPE) ───────────
  await knex.schema.createTable('clients', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // SURNAME (max 40) + NAME (max 20) + F_NAME (max 20)
    t.string('surname', 40).notNullable();
    t.string('name', 20).notNullable();
    t.string('father_name', 20);
    t.string('mother_name', 20);
    // owner_type: 1=physical, 2=legal (OWNER_TYPE from XSD)
    t.integer('owner_type').notNullable().defaultTo(1);
    t.string('email', 64);
    // TELEPHONE (10-16 chars, pattern: (+)?[0-9]{10,15})
    t.string('phone', 16);
    t.string('mobile', 16);
    // AFM (max 10) — Greek Tax ID
    t.string('afm', 10);
    // AFM_EX (max 32) — foreign tax ID
    t.string('afm_ex', 32);
    // ADT (max 8) — ID card number
    t.string('adt', 8);
    // ADDRESS (max 64), CITY (max 32), ZIP_CODE (max 5)
    t.string('address', 64);
    t.string('city', 32);
    t.string('zip_code', 5);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── projects ────────────────────────────────────────────────────────
  await knex.schema.createTable('projects', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 20).unique().notNullable(); // PRJ-2026-001
    // permit type: vod | cat1 | cat2 | cat3 | (future: demolish, etc.)
    t.string('type', 20).notNullable();
    t.string('title', 255).notNullable();
    // workflow stage
    t.string('stage', 30).notNullable().defaultTo('init');
    t.integer('progress').defaultTo(0).checkBetween([0, 100]);
    t.uuid('client_id').references('id').inTable('clients');
    t.uuid('created_by').references('id').inTable('users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.date('deadline');
    // TEE e-Adeies fields
    t.string('tee_permit_code', 50);    // κωδικός πράξης
    t.date('tee_submission_date');
    // AITISI_TYPE main fields (XSD mapping)
    // AITISI_TYPE (application category code — TEE integer)
    t.integer('aitisi_type_code');
    // YD_ID (Υπηρεσία Δόμησης ID — TEE integer)
    t.integer('yd_id');
    // DIMOS_AA (municipality code — TEE integer)
    t.integer('dimos_aa');
    // AITISI_DESCR (max 1024)
    t.text('aitisi_descr');
    // ENTOS_SXEDIOU: within urban plan (0=no, 1=yes)
    t.integer('entos_sxediou');
    // NATURAL_DISASTER_FLAG: 0|1
    t.integer('natural_disaster_flag').defaultTo(0);
    // MIX_PROJECT_AA: mixed-use project reference
    t.integer('mix_project_aa');
    // GIS polygon (raw XSD string OR PostGIS)
    t.text('gis_location');
    t.text('notes');
    t.boolean('deleted').defaultTo(false);
  });

  // ── properties (AITISI address + KAEK data) ─────────────────────────
  await knex.schema.createTable('properties', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    // KAEK (max 20)
    t.string('kaek', 20);
    // OT — urban block (max 20)
    t.string('ot', 20);
    // ADDR (max 128), ADDR_NUM_FROM (max 5), ADDR_NUM_TO (max 5)
    t.string('addr', 128);
    t.string('addr_num_from', 5);
    t.string('addr_num_to', 5);
    // CITY (max 64), ZIP_CODE (positiveInteger), ADDR_LOCATION (max 128)
    t.string('city', 64);
    t.integer('zip_code');
    t.string('addr_location', 128);
    // PostGIS point (WGS84)
    t.specificType('coordinates', 'GEOMETRY(Point, 4326)');
    // zoning info JSONB: artiotita, sd, kalypsi, ypsos, etc.
    t.jsonb('zoning_info');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── ekdosi (EKDOSI_TYPE — building specification) ───────────────────
  await knex.schema.createTable('ekdosi', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE').unique();
    // EKDOSI_TYPE (permit issuance category)
    t.integer('ekdosi_type').notNullable();
    // EKDOSI_CATEG (optional sub-category)
    t.integer('ekdosi_categ');
    // TOTAL_PLOT_AREA, ROOF_GARDEN_AREA, TOTAL_BUILD_VOLUME (decimalGE0)
    t.decimal('total_plot_area', 12, 2).notNullable().defaultTo(0);
    t.decimal('roof_garden_area', 12, 2).notNullable().defaultTo(0);
    t.decimal('total_build_volume', 12, 2).notNullable().defaultTo(0);
    // NUM_OF_FLOORS, NUM_OF_OWNERSHIPS, NUM_OF_PARKINGS
    t.integer('num_of_floors').notNullable().defaultTo(0);
    t.integer('num_of_ownerships').notNullable().defaultTo(0);
    t.integer('num_of_parkings').notNullable().defaultTo(0);
    t.text('comments');
    // EKDOSI_DD: exactly 15 rows — stored as JSONB array
    // [{dd_row_type, allowed_area, legally_existing_area, legalized_area, regulated_area, tobe_legal_area, new_area}]
    t.jsonb('dd_rows').defaultTo('[]');
    // EKDOSI_ADD_SPECS: [{add_specs_type}]
    t.jsonb('add_specs').defaultTo('[]');
    // EKDOSI_BUILD_FLOOR: [{build_descr, floor_id, usages:[{build_usage, total_build_area}]}]
    t.jsonb('build_floors').defaultTo('[]');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── documents ───────────────────────────────────────────────────────
  await knex.schema.createTable('documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    t.string('doc_type', 50).notNullable();
    t.string('label', 255);
    // pending | uploaded | signed | rejected
    t.string('status', 20).defaultTo('pending');
    // MinIO path: permits/{project_id}/{category}/{filename}
    t.string('file_path', 500);
    t.bigInteger('file_size');
    t.string('file_hash', 64); // SHA-256
    t.string('mime_type', 100);
    t.string('signer_role', 30);
    t.timestamp('signed_at');
    t.string('signature_ref', 255);
    t.timestamp('uploaded_at').defaultTo(knex.fn.now());
    t.uuid('uploaded_by').references('id').inTable('users');
    t.text('notes');
  });

  // ── approvals (AITISI_APPROVAL_TYPE) ────────────────────────────────
  await knex.schema.createTable('approvals', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    // AR_EGRISIS (max 512) — approval reference number
    t.string('ar_egrisis', 512);
    // ISSUER_TYPE (TEE lookup), ISSUER_DATA (max 128)
    t.integer('issuer_type').notNullable();
    t.string('issuer_data', 128);
    // APPROVAL_TYPE (TEE lookup integer)
    t.integer('approval_type').notNullable();
    // TOTAL_AREA (optional decimal >= 0)
    t.decimal('total_area', 12, 2);
    t.string('comments', 255);
    // Extended approvals (v2.9.1) fields
    t.integer('approval_type_ext');
    t.string('aa_protocol', 16);
    t.string('protocol_date', 10); // dd/mm/yyyy
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── doc_rights (AITISI_DOC_RIGHT_TYPE) ──────────────────────────────
  await knex.schema.createTable('doc_rights', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    // AR_ETOS (max 32), ISSUER_TYPE, ISSUER_DATA (max 128), DOC_TYPE
    t.string('ar_etos', 32);
    t.integer('issuer_type').notNullable();
    t.string('issuer_data', 128);
    t.integer('doc_type').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── prev_praxis (AITISI_PREV_PRAXI_TYPE) ───────────────────────────
  await knex.schema.createTable('prev_praxis', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    // PREV_PRAXI_TYPE, AA_PRAXIS (max 32), PROJECT_DESCR (max 128)
    t.integer('prev_praxi_type').notNullable();
    t.string('aa_praxis', 32).notNullable();
    t.string('project_descr', 128).notNullable();
    // PRAXI_DATE, PRAXI_VALID_TO (dd/mm/yyyy or null)
    t.string('praxi_date', 10);
    t.string('praxi_valid_to', 10);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ── workflow_logs ────────────────────────────────────────────────────
  await knex.schema.createTable('workflow_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    t.string('action', 100).notNullable();
    t.string('from_stage', 30);
    t.string('to_stage', 30);
    t.uuid('user_id').references('id').inTable('users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.jsonb('metadata');
  });

  // ── emails ───────────────────────────────────────────────────────────
  await knex.schema.createTable('emails', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    // sent | received
    t.string('direction', 10).notNullable();
    t.string('from_address', 255);
    t.string('to_address', 255);
    t.string('subject', 500);
    t.text('body');
    t.jsonb('attachments'); // [{name, minio_path, size}]
    t.string('message_id', 255);
    t.string('in_reply_to', 255);
    t.timestamp('sent_at').defaultTo(knex.fn.now());
    t.timestamp('read_at');
  });

  // ── indexes ──────────────────────────────────────────────────────────
  await knex.schema.raw('CREATE INDEX idx_projects_stage ON projects(stage)');
  await knex.schema.raw('CREATE INDEX idx_projects_type ON projects(type)');
  await knex.schema.raw('CREATE INDEX idx_projects_client ON projects(client_id)');
  await knex.schema.raw('CREATE INDEX idx_projects_deleted ON projects(deleted)');
  await knex.schema.raw('CREATE INDEX idx_documents_project ON documents(project_id)');
  await knex.schema.raw('CREATE INDEX idx_documents_status ON documents(status)');
  await knex.schema.raw('CREATE INDEX idx_workflow_project ON workflow_logs(project_id)');
  await knex.schema.raw('CREATE INDEX idx_emails_project ON emails(project_id)');
  await knex.schema.raw('CREATE INDEX idx_approvals_project ON approvals(project_id)');
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('emails');
  await knex.schema.dropTableIfExists('workflow_logs');
  await knex.schema.dropTableIfExists('prev_praxis');
  await knex.schema.dropTableIfExists('doc_rights');
  await knex.schema.dropTableIfExists('approvals');
  await knex.schema.dropTableIfExists('documents');
  await knex.schema.dropTableIfExists('ekdosi');
  await knex.schema.dropTableIfExists('properties');
  await knex.schema.dropTableIfExists('projects');
  await knex.schema.dropTableIfExists('clients');
  await knex.schema.dropTableIfExists('users');
}
