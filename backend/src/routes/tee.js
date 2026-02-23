/**
 * TEE e-Adeies sync routes
 *
 * GET  /api/tee/status          — check if user has TEE credentials configured
 * POST /api/tee/sync            — login to TEE and pull all engineer's applications
 * GET  /api/tee/applications    — list raw TEE applications (last sync result)
 * POST /api/tee/import/:teeCode — import a specific TEE application as a project
 */

import db from '../config/database.js';
import { decryptTeePassword } from './auth.js';
import { TeeClient, teeStatusToStage, teeTypeCodeToPermitType } from '../services/tee-client.js';

export default async function teeRoute(fastify) {
  // All TEE routes require authentication
  const auth = { onRequest: [fastify.authenticate] };

  // ── GET /api/tee/status ─────────────────────────────────────────────
  fastify.get('/status', auth, async (req, reply) => {
    const user = await db('users').where({ id: req.user.id })
      .select('tee_username', 'tee_password_enc')
      .first();

    reply.send({
      configured: !!(user?.tee_username && user?.tee_password_enc),
      tee_username: user?.tee_username || null,
    });
  });

  // ── POST /api/tee/sync ──────────────────────────────────────────────
  // Authenticates with TEE portal and fetches all engineer applications.
  // Returns the raw list — does NOT auto-import, lets user choose which to import.
  fastify.post('/sync', auth, async (req, reply) => {
    const user = await db('users').where({ id: req.user.id }).first();

    if (!user?.tee_username || !user?.tee_password_enc) {
      return reply.code(422).send({
        error: 'Δεν έχετε ορίσει στοιχεία ΤΕΕ. Μεταβείτε στο Προφίλ σας.',
      });
    }

    const teePassword = decryptTeePassword(user.tee_password_enc);
    if (!teePassword) {
      return reply.code(500).send({ error: 'Αδυναμία αποκρυπτογράφησης κωδικού ΤΕΕ.' });
    }

    const client = new TeeClient(user.tee_username, teePassword);

    try {
      await client.login();
    } catch (err) {
      return reply.code(401).send({ error: err.message });
    }

    let applications;
    try {
      applications = await client.fetchMyApplications();
    } catch (err) {
      return reply.code(502).send({ error: err.message });
    }

    // Cross-reference with existing projects to mark already-imported ones
    const existingCodes = await db('projects')
      .whereNotNull('tee_permit_code')
      .pluck('tee_permit_code');
    const importedSet = new Set(existingCodes);

    const enriched = applications.map(app => ({
      ...app,
      already_imported: importedSet.has(app.tee_permit_code),
    }));

    // Store sync result in a tee_sync_cache table (or just return it)
    // For MVP we return it directly — the user picks what to import
    reply.send({
      synced_at: new Date().toISOString(),
      count: enriched.length,
      applications: enriched,
    });
  });

  // ── POST /api/tee/import ────────────────────────────────────────────
  // Import one or more TEE applications as OpenAdeia projects.
  // Body: { applications: [{ tee_permit_code, title, aitisi_type_code, ... }] }
  fastify.post('/import', auth, async (req, reply) => {
    const { applications } = req.body;
    if (!Array.isArray(applications) || applications.length === 0) {
      return reply.code(400).send({ error: 'Δεν δόθηκαν αιτήσεις για εισαγωγή' });
    }

    const results = [];
    const year = new Date().getFullYear();
    const [{ count: existingCount }] = await db('projects').count('id as count');
    let seq = Number(existingCount);

    for (const app of applications) {
      // Skip if already imported
      const existing = await db('projects')
        .where({ tee_permit_code: app.tee_permit_code })
        .first();

      if (existing) {
        results.push({ tee_permit_code: app.tee_permit_code, action: 'skipped', id: existing.id });
        continue;
      }

      seq++;
      const code = `PRJ-${year}-${String(seq).padStart(3, '0')}`;

      const permitType = teeTypeCodeToPermitType(app.aitisi_type_code, app.is_continuation);
      const stage = teeStatusToStage(app.tee_status, app.tee_status_code);

      const [project] = await db('projects').insert({
        code,
        title: app.title || `Άδεια ΤΕΕ ${app.tee_permit_code}`,
        type: permitType,
        is_continuation: app.is_continuation || false,
        stage,
        tee_permit_code: app.tee_permit_code,
        aitisi_type_code: app.aitisi_type_code || null,
        yd_id: app.yd_id || null,
        dimos_aa: app.dimos_aa || null,
        tee_submission_date: app.tee_submission_date || null,
        notes: `Εισήχθη από ΤΕΕ e-Adeies (${new Date().toLocaleDateString('el-GR')})`,
        created_by: req.user.id,
      }).returning('*');

      // Create property record if address available
      if (app.address || app.kaek) {
        await db('properties').insert({
          project_id: project.id,
          addr: app.address || null,
          city: app.city || null,
          kaek: app.kaek || null,
        });
      }

      // Log the import
      await db('workflow_logs').insert({
        project_id: project.id,
        action: `Εισαγωγή από ΤΕΕ e-Adeies (κωδ. ${app.tee_permit_code})`,
        to_stage: stage,
        user_id: req.user.id,
        metadata: { source: 'tee_sync', tee_permit_code: app.tee_permit_code },
      });

      results.push({ tee_permit_code: app.tee_permit_code, action: 'imported', id: project.id, code });
    }

    reply.send({ results, imported: results.filter(r => r.action === 'imported').length });
  });

  // ── POST /api/tee/refresh/:id ───────────────────────────────────────
  // Re-fetch a single project's status from TEE and update stage if changed
  fastify.post('/refresh/:id', auth, async (req, reply) => {
    const project = await db('projects').where({ id: req.params.id }).first();
    if (!project || !project.tee_permit_code) {
      return reply.code(404).send({ error: 'Φάκελος δεν βρέθηκε ή δεν συνδέεται με ΤΕΕ' });
    }

    const user = await db('users').where({ id: req.user.id }).first();
    if (!user?.tee_username || !user?.tee_password_enc) {
      return reply.code(422).send({ error: 'Δεν έχετε ορίσει στοιχεία ΤΕΕ.' });
    }

    const teePassword = decryptTeePassword(user.tee_password_enc);
    const client = new TeeClient(user.tee_username, teePassword);

    try {
      await client.login();
      const details = await client.fetchApplicationDetails(project.tee_permit_code);

      if (!details) return reply.code(404).send({ error: 'Δεν βρέθηκε στο ΤΕΕ' });

      const newStage = teeStatusToStage(details.tee_status, details.tee_status_code);

      if (newStage !== project.stage) {
        await db('projects').where({ id: project.id }).update({
          stage: newStage,
          updated_at: db.fn.now(),
        });
        await db('workflow_logs').insert({
          project_id: project.id,
          action: `Ενημέρωση κατάστασης από ΤΕΕ: ${details.tee_status}`,
          from_stage: project.stage,
          to_stage: newStage,
          user_id: req.user.id,
          metadata: { source: 'tee_refresh', tee_status: details.tee_status },
        });
      }

      reply.send({ updated: newStage !== project.stage, stage: newStage, tee_status: details.tee_status });
    } catch (err) {
      reply.code(502).send({ error: err.message });
    }
  });
}
