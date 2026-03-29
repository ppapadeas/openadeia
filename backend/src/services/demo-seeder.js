/**
 * Demo data seeder — creates demo clients + projects for a new tenant.
 * Called during org signup to give new users something to explore.
 *
 * Idempotent: checks for DEMO-001 before inserting anything.
 */
import db from '../config/database.js';

/**
 * Seed demo clients and projects for the given tenant.
 * Idempotent: skips entirely if DEMO-001 already exists for tenant.
 *
 * @param {string} tenantId - UUID of the tenant
 */
export async function seedDemoTenant(tenantId) {
  // Idempotency check — bail out if any demo data already exists
  const existing = await db('projects')
    .where({ tenant_id: tenantId, code: 'DEMO-001' })
    .first();
  if (existing) {
    console.log(`[demo-seeder] Tenant ${tenantId} already has demo data, skipping.`);
    return;
  }

  // ── Clients ────────────────────────────────────────────────────────

  const [client1] = await db('clients').insert({
    tenant_id: tenantId,
    surname: 'Παπαδόπουλος',
    name: 'Γεώργιος',
    father_name: 'Δημήτριος',
    owner_type: 1, // φυσικό πρόσωπο
    email: 'demo-owner@example.com',
    phone: '2101234567',
    mobile: '6981234567',
    afm: '123456789',
    address: 'Λεωφ. Βασιλίσσης Σοφίας 25',
    city: 'Αθήνα',
    zip_code: '10676',
  }).returning(['id', 'name', 'surname']);

  const [client2] = await db('clients').insert({
    tenant_id: tenantId,
    surname: 'Κωνσταντινίδης',
    name: 'Δημήτριος',
    father_name: 'Αλέξανδρος',
    owner_type: 1,
    email: 'demo-owner2@example.com',
    phone: '2310987654',
    mobile: '6972345678',
    afm: '234567891',
    address: 'Τσιμισκή 45',
    city: 'Θεσσαλονίκη',
    zip_code: '54623',
  }).returning(['id', 'name', 'surname']);

  const [client3] = await db('clients').insert({
    tenant_id: tenantId,
    surname: 'Αλεξίου',
    name: 'Μαρία',
    father_name: 'Νικόλαος',
    owner_type: 1,
    email: 'demo-owner3@example.com',
    phone: '2721056789',
    mobile: '6945678901',
    afm: '345678912',
    address: 'Κολοκοτρώνη 12',
    city: 'Καλαμάτα',
    zip_code: '24100',
  }).returning(['id', 'name', 'surname']);

  const [client4] = await db('clients').insert({
    tenant_id: tenantId,
    surname: 'Νικολάου',
    name: 'Ελένη & Σπύρος',
    father_name: 'Κωνσταντίνος',
    owner_type: 1,
    email: 'demo-couple@example.com',
    phone: '2101112233',
    mobile: '6934567890',
    afm: '456789123',
    address: 'Λεωφ. Βασιλίσσης Σοφίας 25',
    city: 'Αθήνα',
    zip_code: '10676',
  }).returning(['id', 'name', 'surname']);

  const [client5] = await db('clients').insert({
    tenant_id: tenantId,
    surname: 'ΑΦΟΙ ΠΑΠΑΓΕΩΡΓΙΟΥ Ο.Ε.',
    name: '-',
    father_name: null,
    owner_type: 2, // νομικό πρόσωπο
    email: 'demo-company@example.com',
    phone: '2310223344',
    mobile: '6911223344',
    afm: '567891234',
    address: 'Τσιμισκή 45',
    city: 'Θεσσαλονίκη',
    zip_code: '54623',
  }).returning(['id', 'name', 'surname']);

  // ── Projects ───────────────────────────────────────────────────────

  // DEMO-001: cat2 — Οικοδομική Άδεια Κατηγορίας 2, stage: studies
  const [project1] = await db('projects').insert({
    tenant_id: tenantId,
    code: 'DEMO-001',
    title: 'Νέα Οικοδομή — Κατ. 2 Demo Φάκελος',
    type: 'cat2',
    stage: 'studies',
    client_id: client1.id,
    notes: [
      'Αυτός είναι ένας demo φάκελος για να εξοικειωθείτε με το OpenAdeia.',
      '',
      'Μπορείτε να:',
      '• Εξερευνήσετε τα στάδια ροής εργασίας (workflow)',
      '• Ανεβάσετε έγγραφα',
      '• Δείτε τον υπολογισμό αμοιβών',
      '• Δοκιμάσετε τον έλεγχο ΝΟΚ',
      '',
      'Διαγράψτε αυτό το project όταν είστε έτοιμοι να ξεκινήσετε με πραγματικά δεδομένα.',
    ].join('\n'),
  }).returning(['id', 'code', 'title', 'stage']);

  // DEMO-002: vod — Βεβαίωση Όρων Δόμησης, stage: submission
  const [project2] = await db('projects').insert({
    tenant_id: tenantId,
    code: 'DEMO-002',
    title: 'Βεβαίωση Όρων Δόμησης — Τσιμισκή 45',
    type: 'vod',
    stage: 'submission',
    client_id: client2.id,
    notes: [
      'Demo φάκελος ΒΟΔ για οικόπεδο στη Θεσσαλονίκη.',
      'Έχει κατατεθεί στο e-Άδειες — αναμονή αποτελέσματος.',
    ].join('\n'),
  }).returning(['id', 'code', 'title', 'stage']);

  // DEMO-003: cat1 — Μικρή Κλίμακα, stage: approved
  const [project3] = await db('projects').insert({
    tenant_id: tenantId,
    code: 'DEMO-003',
    title: 'Μικρής Κλίμακας Επέμβαση — Κολοκοτρώνη 12',
    type: 'cat1',
    stage: 'approved',
    client_id: client3.id,
    notes: [
      'Demo φάκελος Μικρής Κλίμακας — εγκεκριμένος.',
      'Αφορά αλλαγή χρήσης ισογείου σε Καλαμάτα.',
    ].join('\n'),
  }).returning(['id', 'code', 'title', 'stage']);

  // ── Workflow logs ──────────────────────────────────────────────────

  // DEMO-001: data_collection → studies
  await db('workflow_logs').insert([
    {
      tenant_id: tenantId,
      project_id: project1.id,
      action: 'Δημιουργία demo φακέλου',
      from_stage: null,
      to_stage: 'data_collection',
      metadata: JSON.stringify({ seeded: true }),
    },
    {
      tenant_id: tenantId,
      project_id: project1.id,
      action: 'Συλλογή στοιχείων ολοκληρώθηκε',
      from_stage: 'data_collection',
      to_stage: 'studies',
      metadata: JSON.stringify({ seeded: true }),
    },
  ]);

  // DEMO-002: data_collection → studies → submission
  await db('workflow_logs').insert([
    {
      tenant_id: tenantId,
      project_id: project2.id,
      action: 'Δημιουργία φακέλου ΒΟΔ',
      from_stage: null,
      to_stage: 'data_collection',
      metadata: JSON.stringify({ seeded: true }),
    },
    {
      tenant_id: tenantId,
      project_id: project2.id,
      action: 'Προετοιμασία τοπογραφικού & αίτησης',
      from_stage: 'data_collection',
      to_stage: 'studies',
      metadata: JSON.stringify({ seeded: true }),
    },
    {
      tenant_id: tenantId,
      project_id: project2.id,
      action: 'Κατάθεση στο e-Άδειες',
      from_stage: 'studies',
      to_stage: 'submission',
      metadata: JSON.stringify({ seeded: true, submitted_via: 'e-Adeies' }),
    },
  ]);

  // DEMO-003: data_collection → studies → submission → approved
  await db('workflow_logs').insert([
    {
      tenant_id: tenantId,
      project_id: project3.id,
      action: 'Δημιουργία φακέλου Μικρής Κλίμακας',
      from_stage: null,
      to_stage: 'data_collection',
      metadata: JSON.stringify({ seeded: true }),
    },
    {
      tenant_id: tenantId,
      project_id: project3.id,
      action: 'Εκπόνηση μελετών',
      from_stage: 'data_collection',
      to_stage: 'studies',
      metadata: JSON.stringify({ seeded: true }),
    },
    {
      tenant_id: tenantId,
      project_id: project3.id,
      action: 'Κατάθεση δικαιολογητικών',
      from_stage: 'studies',
      to_stage: 'submission',
      metadata: JSON.stringify({ seeded: true }),
    },
    {
      tenant_id: tenantId,
      project_id: project3.id,
      action: 'Έγκριση αδείας από ΥΠΕΝ',
      from_stage: 'submission',
      to_stage: 'approved',
      metadata: JSON.stringify({ seeded: true, approved_by: 'ΥΠΕΝ' }),
    },
  ]);

  console.log(`[demo-seeder] Created demo data for tenant ${tenantId}:`, {
    clients: [
      `${client1.surname} ${client1.name}`,
      `${client2.surname} ${client2.name}`,
      `${client3.surname} ${client3.name}`,
      `${client4.surname} ${client4.name}`,
      client5.surname,
    ],
    projects: [project1.code, project2.code, project3.code],
  });

  return {
    clients: [client1, client2, client3, client4, client5],
    projects: [project1, project2, project3],
  };
}
