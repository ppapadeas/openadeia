/**
 * Migration 005 — Fee Engine (αμοιβές μηχανικών)
 * Source law: ΦΕΚ Β' 2422/2013 (Απόφαση Δ17α/115/9/ΦΝ433)
 * Lambda (λ) is the quarterly construction cost index coefficient.
 */

export async function up(knex) {
  await knex.schema.createTable('fee_lambda', (t) => {
    t.increments('id');
    t.integer('period_code').notNullable().unique();
    t.string('description', 40);
    t.decimal('lambda', 8, 5).notNullable();
  });

  await knex.schema.createTable('fee_calculations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    t.uuid('created_by').references('id').inTable('users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.integer('lambda_code');
    t.decimal('lambda_value', 8, 5);
    t.decimal('fpa_rate', 5, 2).defaultTo(24);
    t.jsonb('areas');
    t.jsonb('difficulty');
    t.jsonb('active_studies');
    t.jsonb('ks_percents');
    t.boolean('is_demolition').defaultTo(false);
    t.decimal('result_p', 12, 2);
    t.decimal('result_sa', 12, 2);
    t.decimal('result_se', 12, 2);
    t.decimal('result_sum', 12, 2);
    t.decimal('result_pa1', 12, 2);
    t.decimal('result_p1', 12, 2);
    t.jsonb('breakdown');
    t.text('notes');
    t.boolean('is_official').defaultTo(false);
  });

  await knex.schema.raw('CREATE INDEX idx_fee_calc_project ON fee_calculations(project_id)');
  await knex.schema.raw('CREATE INDEX idx_fee_calc_official ON fee_calculations(project_id, is_official)');

  await knex('fee_lambda').insert([
    {period_code:19971, description:"1997 Α' ΤΡΙΜΗΝΟ", lambda:0.12523},
    {period_code:19972, description:"1997 Β' ΤΡΙΜΗΝΟ", lambda:0.12633},
    {period_code:19973, description:"1997 Γ' ΤΡΙΜΗΝΟ", lambda:0.13030},
    {period_code:19974, description:"1997 Δ' ΤΡΙΜΗΝΟ", lambda:0.13140},
    {period_code:19981, description:"1998 Α' ΤΡΙΜΗΝΟ", lambda:0.13338},
    {period_code:19982, description:"1998 Β' ΤΡΙΜΗΝΟ", lambda:0.13492},
    {period_code:19983, description:"1998 Γ' ΤΡΙΜΗΝΟ", lambda:0.13756},
    {period_code:19984, description:"1998 Δ' ΤΡΙΜΗΝΟ", lambda:0.13756},
    {period_code:19991, description:"1999 Α' ΤΡΙΜΗΝΟ", lambda:0.13998},
    {period_code:19992, description:"1999 Β' ΤΡΙΜΗΝΟ", lambda:0.13998},
    {period_code:19993, description:"1999 Γ' ΤΡΙΜΗΝΟ", lambda:0.14196},
    {period_code:19994, description:"1999 Δ' ΤΡΙΜΗΝΟ", lambda:0.14196},
    {period_code:20001, description:"2000 Α' ΤΡΙΜΗΝΟ", lambda:0.14416},
    {period_code:20002, description:"2000 Β' ΤΡΙΜΗΝΟ", lambda:0.14592},
    {period_code:20003, description:"2000 Γ' ΤΡΙΜΗΝΟ", lambda:0.14812},
    {period_code:20004, description:"2000 Δ' ΤΡΙΜΗΝΟ", lambda:0.14812},
    {period_code:20011, description:"2001 Α' ΤΡΙΜΗΝΟ", lambda:0.15077},
    {period_code:20012, description:"2001 Β' ΤΡΙΜΗΝΟ", lambda:0.15077},
    {period_code:20013, description:"2001 Γ' ΤΡΙΜΗΝΟ", lambda:0.15297},
    {period_code:20014, description:"2001 Δ' ΤΡΙΜΗΝΟ", lambda:0.15297},
    {period_code:20021, description:"2002 Α' ΤΡΙΜΗΝΟ", lambda:0.15846},
    {period_code:20022, description:"2002 Β' ΤΡΙΜΗΝΟ", lambda:0.15846},
    {period_code:20023, description:"2002 Γ' ΤΡΙΜΗΝΟ", lambda:0.16131},
    {period_code:20024, description:"2002 Δ' ΤΡΙΜΗΝΟ", lambda:0.16131},
    {period_code:20031, description:"2003 Α' ΤΡΙΜΗΝΟ", lambda:0.16809},
    {period_code:20032, description:"2003 Β' ΤΡΙΜΗΝΟ", lambda:0.16809},
    {period_code:20033, description:"2003 Γ' ΤΡΙΜΗΝΟ", lambda:0.16809},
    {period_code:20034, description:"2003 Δ' ΤΡΙΜΗΝΟ", lambda:0.16809},
    {period_code:20041, description:"2004 Α' ΤΡΙΜΗΝΟ", lambda:0.17397},
    {period_code:20042, description:"2004 Β' ΤΡΙΜΗΝΟ", lambda:0.17481},
    {period_code:20043, description:"2004 Γ' ΤΡΙΜΗΝΟ", lambda:0.17481},
    {period_code:20044, description:"2004 Δ' ΤΡΙΜΗΝΟ", lambda:0.17830},
    {period_code:20051, description:"2005 Α' ΤΡΙΜΗΝΟ", lambda:0.18223},
    {period_code:20052, description:"2005 Β' ΤΡΙΜΗΝΟ", lambda:0.18223},
    {period_code:20053, description:"2005 Γ' ΤΡΙΜΗΝΟ", lambda:0.18223},
    {period_code:20054, description:"2005 Δ' ΤΡΙΜΗΝΟ", lambda:0.18586},
    {period_code:20061, description:"2006 Α' ΤΡΙΜΗΝΟ", lambda:0.19126},
    {period_code:20062, description:"2006 Β' ΤΡΙΜΗΝΟ", lambda:0.19126},
    {period_code:20063, description:"2006 Γ' ΤΡΙΜΗΝΟ", lambda:0.19126},
    {period_code:20064, description:"2006 Δ' ΤΡΙΜΗΝΟ", lambda:0.19681},
    {period_code:20071, description:"2007 Α' ΤΡΙΜΗΝΟ", lambda:0.19681},
    {period_code:20072, description:"2007 Β' ΤΡΙΜΗΝΟ", lambda:0.19681},
    {period_code:20073, description:"2007 Γ' ΤΡΙΜΗΝΟ", lambda:0.20685},
    {period_code:20074, description:"2007 Δ' ΤΡΙΜΗΝΟ", lambda:0.20685},
    {period_code:20081, description:"2008 Α' ΤΡΙΜΗΝΟ", lambda:0.21399},
    {period_code:20082, description:"2008 Β' ΤΡΙΜΗΝΟ", lambda:0.22041},
    {period_code:20083, description:"2008 Γ' ΤΡΙΜΗΝΟ", lambda:0.22041},
    {period_code:20084, description:"2008 Δ' ΤΡΙΜΗΝΟ", lambda:0.22041},
    {period_code:20091, description:"2009 Α' ΤΡΙΜΗΝΟ", lambda:0.22041},
    {period_code:20092, description:"2009 Β' ΤΡΙΜΗΝΟ", lambda:0.22041},
    {period_code:20093, description:"2009 Γ' ΤΡΙΜΗΝΟ", lambda:0.23253},
    {period_code:20094, description:"2009 Δ' ΤΡΙΜΗΝΟ", lambda:0.23253},
    {period_code:20101, description:"2010 Α' ΤΡΙΜΗΝΟ", lambda:0.23368},
    {period_code:20102, description:"2010 Β' ΤΡΙΜΗΝΟ", lambda:0.23368},
    {period_code:20103, description:"2010 Γ' ΤΡΙΜΗΝΟ", lambda:0.23368},
    {period_code:20104, description:"2010 Δ' ΤΡΙΜΗΝΟ", lambda:0.23368},
    {period_code:20111, description:"2011 Α' ΤΡΙΜΗΝΟ", lambda:0.23368},
    {period_code:20112, description:"2011 Β' ΤΡΙΜΗΝΟ", lambda:0.23368},
    {period_code:20113, description:"2011 Γ' ΤΡΙΜΗΝΟ", lambda:0.23368},
    {period_code:20114, description:"2011 Δ' ΤΡΙΜΗΝΟ", lambda:0.23368},
    {period_code:20121, description:"2012 Α' ΤΡΙΜΗΝΟ", lambda:0.23368},
  ]);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('fee_calculations');
  await knex.schema.dropTableIfExists('fee_lambda');
}
