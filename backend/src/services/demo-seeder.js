/**
 * Demo data seeder — creates a demo client + project for a new tenant.
 * Called during org signup to give new users something to explore.
 */
import db from '../config/database.js';

/**
 * Seed a demo client and project for the given tenant.
 * Idempotent: skips if DEMO-001 already exists for tenant.
 *
 * @param {string} tenantId - UUID of the tenant
 */
export async function seedDemoTenant(tenantId) {
  // Idempotency check
  const existing = await db('projects')
    .where({ tenant_id: tenantId, code: 'DEMO-001' })
    .first();
  if (existing) {
    console.log(`[demo-seeder] Tenant ${tenantId} already has demo data, skipping.`);
    return;
  }

  // Create demo client (property owner)
  const [demoClient] = await db('clients').insert({
    tenant_id: tenantId,
    surname: 'Παπαδόπουλος',
    name: 'Γεώργιος',
    father_name: 'Δημήτριος',
    owner_type: 1, // φυσικό πρόσωπο
    email: 'demo-owner@example.com',
    phone: '2101234567',
    mobile: '6981234567',
    afm: '123456789',
    address: 'Ερμού 10',
    city: 'Αθήνα',
    zip_code: '10563',
  }).returning(['id', 'name', 'surname']);

  // Create demo project
  const [demoProject] = await db('projects').insert({
    tenant_id: tenantId,
    code: 'DEMO-001',
    title: 'Νέα Οικοδομική Άδεια — Demo Φάκελος',
    type: 'new_building',
    stage: 'data_collection',
    client_id: demoClient.id,
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

  // Add initial workflow log
  await db('workflow_logs').insert({
    tenant_id: tenantId,
    project_id: demoProject.id,
    action: 'Δημιουργία demo φακέλου',
    to_stage: 'data_collection',
    metadata: JSON.stringify({ seeded: true }),
  });

  console.log(`[demo-seeder] Created demo data for tenant ${tenantId}:`, {
    client: `${demoClient.surname} ${demoClient.name}`,
    project: demoProject.code,
  });

  return { client: demoClient, project: demoProject };
}
