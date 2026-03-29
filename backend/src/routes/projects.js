import db from '../config/database.js';
import { createProjectSchema, updateProjectSchema, zodValidator } from '../middleware/validate.js';
import {
  checkProjectLimit,
  decrementProjectCount,
  incrementProjectCount,
} from '../services/usage.js';
import { tenantHook } from '../hooks/tenant.js';

export default async function projectsRoute(fastify) {
  // Shared preHandler: authenticate + resolve tenant
  const auth = [fastify.authenticate, tenantHook];

  // GET /api/projects
  fastify.get('/', { onRequest: auth }, async (req, reply) => {
    const { stage, type, q, page = 1, limit = 20 } = req.query;
    const tenantId = req.tenantId;

    let query = db('projects as p')
      .leftJoin('clients as c', 'p.client_id', 'c.id')
      .leftJoin('properties as pr', 'pr.project_id', 'p.id')
      .where('p.deleted', false)
      .where('p.tenant_id', tenantId)
      .select(
        'p.*',
        db.raw("concat(c.surname, ' ', c.name) as client_name"),
        'c.email as client_email',
        'c.phone as client_phone',
        'pr.addr', 'pr.city', 'pr.kaek',
      )
      .orderBy('p.updated_at', 'desc');

    if (stage) query = query.where('p.stage', stage);
    if (type) query = query.where('p.type', type);
    if (q) query = query.where(b => b
      .whereILike('p.title', `%${q}%`)
      .orWhereILike('p.code', `%${q}%`)
      .orWhereILike('c.surname', `%${q}%`)
    );

    const offset = (Number(page) - 1) * Number(limit);
    const [{ count }] = await query.clone().clearSelect().clearOrder().count('p.id as count');
    const rows = await query.limit(Number(limit)).offset(offset);

    reply.send({ data: rows, total: Number(count), page: Number(page), limit: Number(limit) });
  });

  // POST /api/projects
  fastify.post('/', { onRequest: auth, preHandler: zodValidator(createProjectSchema) }, async (req, reply) => {
    const body = req.body;
    const tenantId = req.tenantId;

    // Check plan limit before creating
    await checkProjectLimit(tenantId);

    // Generate project code (scoped to tenant)
    const [{ count }] = await db('projects').where({ tenant_id: tenantId }).count('id as count');
    const year = new Date().getFullYear();
    const code = `PRJ-${year}-${String(Number(count) + 1).padStart(3, '0')}`;

    const [project] = await db('projects').insert({
      ...body,
      code,
      tenant_id: tenantId,
    }).returning('*');

    await db('workflow_logs').insert({
      project_id: project.id,
      tenant_id: tenantId,
      action: 'Δημιουργία φακέλου',
      from_stage: null,
      to_stage: 'init',
    });

    await incrementProjectCount(tenantId);

    reply.code(201).send(project);
  });

  // GET /api/projects/:id
  fastify.get('/:id', { onRequest: auth }, async (req, reply) => {
    const tenantId = req.tenantId;
    const project = await db('projects as p')
      .leftJoin('clients as c', 'p.client_id', 'c.id')
      .leftJoin('properties as pr', 'pr.project_id', 'p.id')
      .leftJoin('ekdosi as ek', 'ek.project_id', 'p.id')
      .where({ 'p.id': req.params.id, 'p.deleted': false, 'p.tenant_id': tenantId })
      .select('p.*',
        db.raw('row_to_json(c.*) as client'),
        db.raw('row_to_json(pr.*) as property'),
        db.raw('row_to_json(ek.*) as ekdosi'),
      )
      .first();

    if (!project) return reply.code(404).send({ error: 'Not found' });
    reply.send(project);
  });

  // PATCH /api/projects/:id
  fastify.patch('/:id', { onRequest: auth, preHandler: zodValidator(updateProjectSchema) }, async (req, reply) => {
    const tenantId = req.tenantId;
    const [updated] = await db('projects')
      .where({ id: req.params.id, deleted: false, tenant_id: tenantId })
      .update({ ...req.body, updated_at: db.fn.now() })
      .returning('*');
    if (!updated) return reply.code(404).send({ error: 'Not found' });
    reply.send(updated);
  });

  // DELETE /api/projects/:id (soft delete)
  fastify.delete('/:id', { onRequest: auth }, async (req, reply) => {
    const tenantId = req.tenantId;
    const [updated] = await db('projects')
      .where({ id: req.params.id, tenant_id: tenantId })
      .update({ deleted: true, updated_at: db.fn.now() })
      .returning('id');
    if (!updated) return reply.code(404).send({ error: 'Not found' });

    await decrementProjectCount(tenantId);

    reply.send({ success: true });
  });

  // GET /api/projects/:id/xml  — generate TEE XML
  fastify.get('/:id/xml', { onRequest: auth }, async (req, reply) => {
    const { generateXML } = await import('../utils/xml-generator.js');
    const tenantId = req.tenantId;
    const project = await db('projects').where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!project) return reply.code(404).send({ error: 'Not found' });

    const property = await db('properties').where({ project_id: req.params.id }).first();
    const ekdosi = await db('ekdosi').where({ project_id: req.params.id }).first();
    const owners = await db('clients').where({ id: project.client_id });
    const engineers = await db('users').where({ id: project.created_by });
    const docRights = await db('doc_rights').where({ project_id: req.params.id });
    const approvals = await db('approvals').where({ project_id: req.params.id });
    const prevPraxis = await db('prev_praxis').where({ project_id: req.params.id });

    const xml = generateXML({ project, property, ekdosi, owners, engineers, docRights, approvals, approvalsExt: [], parkings: [], prevPraxis });
    reply.header('Content-Type', 'application/xml').send(xml);
  });
}
