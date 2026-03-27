import { randomUUID } from 'crypto';
import db from '../config/database.js';
import minioClient from '../config/minio.js';

const PORTAL_BUCKET = process.env.MINIO_PORTAL_BUCKET || 'portal';

/**
 * Ensure the portal MinIO bucket exists.
 * Called lazily on first upload.
 */
async function ensurePortalBucket() {
  const exists = await minioClient.bucketExists(PORTAL_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(PORTAL_BUCKET, 'eu-west-1');
  }
}

/**
 * Get full portal data (project + steps + form_data + files)
 * for a given portal_project row.
 */
async function loadPortalData(portalProject) {
  const steps = await db('portal_steps')
    .where({ portal_project_id: portalProject.id })
    .orderBy('sort_order');

  const stepIds = steps.map((s) => s.id);

  let formDataMap = {};
  let filesMap = {};

  if (stepIds.length > 0) {
    const formRows = await db('portal_form_data').whereIn('step_id', stepIds);
    for (const row of formRows) {
      if (!formDataMap[row.step_id]) formDataMap[row.step_id] = {};
      formDataMap[row.step_id][row.field_name] = row.field_value;
    }

    const fileRows = await db('portal_files')
      .whereIn('step_id', stepIds)
      .select('id', 'step_id', 'original_name', 'mime_type', 'size_bytes', 'uploaded_at');
    for (const row of fileRows) {
      if (!filesMap[row.step_id]) filesMap[row.step_id] = [];
      filesMap[row.step_id].push(row);
    }
  }

  return {
    ...portalProject,
    steps: steps.map((s) => ({
      ...s,
      form_data: formDataMap[s.id] || {},
      files: filesMap[s.id] || [],
    })),
  };
}

export default async function portalRoutes(fastify) {
  // ── Admin: POST / — create portal for a project ────────────────────
  fastify.post('/', {
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const { project_id, status, language, owners_count, client_message } = req.body || {};

    if (!project_id) return reply.code(400).send({ error: 'project_id required' });

    // Check project exists
    const project = await db('projects').where({ id: project_id }).first();
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    // Check if portal already exists
    const existing = await db('portal_projects').where({ project_id }).first();
    if (existing) return reply.code(409).send({ error: 'Portal already exists for this project', portal: existing });

    const token = randomUUID();
    const [portal] = await db('portal_projects').insert({
      project_id,
      token,
      status: status || 'draft',
      language: language || 'el',
      owners_count: owners_count || 1,
      client_message: client_message || '',
    }).returning('*');

    const baseUrl = (await db('portal_settings').where({ key: 'base_url' }).first())?.value
      || process.env.PORTAL_BASE_URL
      || 'http://localhost:3000';

    reply.code(201).send({
      ...portal,
      portal_url: `${baseUrl}/portal/${token}`,
    });
  });

  // ── Admin: GET /:projectId — get portal by project ─────────────────
  fastify.get('/:projectId', {
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const portal = await db('portal_projects')
      .where({ project_id: req.params.projectId })
      .first();

    if (!portal) return reply.code(404).send({ error: 'Portal not found' });

    const data = await loadPortalData(portal);

    const baseUrl = (await db('portal_settings').where({ key: 'base_url' }).first())?.value
      || process.env.PORTAL_BASE_URL
      || 'http://localhost:3000';

    reply.send({ ...data, portal_url: `${baseUrl}/portal/${portal.token}` });
  });

  // ── Admin: PATCH /:id — update portal (message, status) ───────────
  fastify.patch('/:id', {
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const allowed = ['status', 'client_message', 'language', 'owners_count'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = db.fn.now();

    const [portal] = await db('portal_projects')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*');

    if (!portal) return reply.code(404).send({ error: 'Portal not found' });
    reply.send(portal);
  });

  // ── Admin: POST /:id/steps — add step to portal ────────────────────
  fastify.post('/:id/steps', {
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const portal = await db('portal_projects').where({ id: req.params.id }).first();
    if (!portal) return reply.code(404).send({ error: 'Portal not found' });

    const { type, title, description, sort_order, required, review_required, config, status } = req.body || {};
    if (!type || !title) return reply.code(400).send({ error: 'type and title required' });

    const [step] = await db('portal_steps').insert({
      portal_project_id: req.params.id,
      type,
      title,
      description: description || null,
      sort_order: sort_order ?? 0,
      required: required !== false,
      review_required: review_required || false,
      config: config ? JSON.stringify(config) : '{}',
      status: status || 'available',
    }).returning('*');

    reply.code(201).send(step);
  });

  // ── Admin: PATCH /steps/:stepId — update step ──────────────────────
  fastify.patch('/steps/:stepId', {
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const allowed = ['type', 'title', 'description', 'sort_order', 'required', 'review_required', 'config', 'status', 'admin_comment'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.config && typeof updates.config === 'object') {
      updates.config = JSON.stringify(updates.config);
    }

    const [step] = await db('portal_steps')
      .where({ id: req.params.stepId })
      .update(updates)
      .returning('*');

    if (!step) return reply.code(404).send({ error: 'Step not found' });
    reply.send(step);
  });

  // ── Admin: POST /steps/:stepId/review — approve or request revision ─
  fastify.post('/steps/:stepId/review', {
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const { action, comment } = req.body || {};
    if (!action || !['approve', 'revision'].includes(action)) {
      return reply.code(400).send({ error: 'action must be "approve" or "revision"' });
    }

    const step = await db('portal_steps').where({ id: req.params.stepId }).first();
    if (!step) return reply.code(404).send({ error: 'Step not found' });

    const newStatus = action === 'approve' ? 'done' : 'revision';
    const [updated] = await db('portal_steps')
      .where({ id: req.params.stepId })
      .update({
        status: newStatus,
        admin_comment: comment || null,
        reviewed_at: db.fn.now(),
        completed_at: action === 'approve' ? db.fn.now() : null,
      })
      .returning('*');

    // Log activity
    await db('portal_activity_log').insert({
      portal_project_id: step.portal_project_id,
      step_id: step.id,
      action: `step_${newStatus}`,
      actor: 'admin',
      details: comment || null,
    });

    reply.send(updated);
  });

  // ══════════════════════════════════════════════════════════════════════
  // CLIENT ROUTES (token-based, no auth)
  // ══════════════════════════════════════════════════════════════════════

  // ── PUBLIC: GET /p/:token — get portal data for client ─────────────
  fastify.get('/p/:token', async (req, reply) => {
    const portal = await db('portal_projects')
      .where({ token: req.params.token })
      .first();

    if (!portal) return reply.code(404).send({ error: 'Portal not found' });
    if (portal.status === 'draft') return reply.code(403).send({ error: 'Portal not yet active' });

    // Fetch linked project info
    const project = await db('projects').where({ id: portal.project_id }).first();

    const data = await loadPortalData(portal);
    reply.send({ ...data, project_title: project?.title || '' });
  });

  // ── PUBLIC: POST /p/:token/steps/:stepId/submit — submit form data ─
  fastify.post('/p/:token/steps/:stepId/submit', async (req, reply) => {
    const portal = await db('portal_projects').where({ token: req.params.token }).first();
    if (!portal) return reply.code(404).send({ error: 'Portal not found' });

    const step = await db('portal_steps')
      .where({ id: req.params.stepId, portal_project_id: portal.id })
      .first();
    if (!step) return reply.code(404).send({ error: 'Step not found' });

    const formData = req.body || {};
    if (typeof formData !== 'object') return reply.code(400).send({ error: 'Body must be a JSON object' });

    // Upsert each field
    for (const [field_name, field_value] of Object.entries(formData)) {
      const existing = await db('portal_form_data')
        .where({ step_id: step.id, field_name })
        .first();
      if (existing) {
        await db('portal_form_data')
          .where({ id: existing.id })
          .update({ field_value: String(field_value) });
      } else {
        await db('portal_form_data').insert({
          step_id: step.id,
          field_name,
          field_value: String(field_value),
        });
      }
    }

    // Update step status
    const newStatus = step.review_required ? 'submitted' : 'done';
    const [updated] = await db('portal_steps')
      .where({ id: step.id })
      .update({
        status: newStatus,
        submitted_at: db.fn.now(),
        completed_at: newStatus === 'done' ? db.fn.now() : null,
      })
      .returning('*');

    // Log
    await db('portal_activity_log').insert({
      portal_project_id: portal.id,
      step_id: step.id,
      action: 'form_submitted',
      actor: 'client',
    });

    reply.send(updated);
  });

  // ── PUBLIC: POST /p/:token/steps/:stepId/upload — upload file ──────
  fastify.post('/p/:token/steps/:stepId/upload', async (req, reply) => {
    const portal = await db('portal_projects').where({ token: req.params.token }).first();
    if (!portal) return reply.code(404).send({ error: 'Portal not found' });

    const step = await db('portal_steps')
      .where({ id: req.params.stepId, portal_project_id: portal.id })
      .first();
    if (!step) return reply.code(404).send({ error: 'Step not found' });

    await ensurePortalBucket();

    const parts = req.parts();
    const uploaded = [];

    for await (const part of parts) {
      if (part.type !== 'file') continue;

      const ext = part.filename.split('.').pop();
      const safeFilename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
      const minioPath = `${portal.project_id}/${step.id}/uploads/${safeFilename}`;

      const chunks = [];
      let size = 0;
      for await (const chunk of part.file) {
        chunks.push(chunk);
        size += chunk.length;
      }
      const buffer = Buffer.concat(chunks);

      await minioClient.putObject(PORTAL_BUCKET, minioPath, buffer, size, {
        'Content-Type': part.mimetype,
      });

      const [fileRow] = await db('portal_files').insert({
        step_id: step.id,
        original_name: part.filename,
        minio_path: minioPath,
        mime_type: part.mimetype,
        size_bytes: size,
      }).returning('*');

      uploaded.push(fileRow);
    }

    if (uploaded.length === 0) {
      return reply.code(400).send({ error: 'No file received' });
    }

    // Update step status
    const newStatus = step.review_required ? 'submitted' : 'done';
    await db('portal_steps')
      .where({ id: step.id })
      .update({
        status: newStatus,
        submitted_at: db.fn.now(),
        completed_at: newStatus === 'done' ? db.fn.now() : null,
      });

    // Log
    await db('portal_activity_log').insert({
      portal_project_id: portal.id,
      step_id: step.id,
      action: 'file_uploaded',
      actor: 'client',
      details: uploaded.map((f) => f.original_name).join(', '),
    });

    reply.code(201).send({ uploaded });
  });
}
