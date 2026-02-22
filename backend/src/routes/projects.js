import db from '../config/database.js';
import { createProjectSchema, updateProjectSchema, zodValidator } from '../middleware/validate.js';

export default async function projectsRoute(fastify) {
  // GET /api/projects
  fastify.get('/', async (req, reply) => {
    const { stage, type, q, page = 1, limit = 20 } = req.query;
    let query = db('projects as p')
      .leftJoin('clients as c', 'p.client_id', 'c.id')
      .leftJoin('properties as pr', 'pr.project_id', 'p.id')
      .where('p.deleted', false)
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
    const [{ count }] = await query.clone().count('p.id as count');
    const rows = await query.limit(Number(limit)).offset(offset);

    reply.send({ data: rows, total: Number(count), page: Number(page), limit: Number(limit) });
  });

  // POST /api/projects
  fastify.post('/', { preHandler: zodValidator(createProjectSchema) }, async (req, reply) => {
    const body = req.body;

    // Generate project code
    const [{ count }] = await db('projects').count('id as count');
    const year = new Date().getFullYear();
    const code = `PRJ-${year}-${String(Number(count) + 1).padStart(3, '0')}`;

    const [project] = await db('projects').insert({
      ...body,
      code,
    }).returning('*');

    await db('workflow_logs').insert({
      project_id: project.id,
      action: 'Δημιουργία φακέλου',
      from_stage: null,
      to_stage: 'init',
    });

    reply.code(201).send(project);
  });

  // GET /api/projects/:id
  fastify.get('/:id', async (req, reply) => {
    const project = await db('projects as p')
      .leftJoin('clients as c', 'p.client_id', 'c.id')
      .leftJoin('properties as pr', 'pr.project_id', 'p.id')
      .leftJoin('ekdosi as ek', 'ek.project_id', 'p.id')
      .where({ 'p.id': req.params.id, 'p.deleted': false })
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
  fastify.patch('/:id', { preHandler: zodValidator(updateProjectSchema) }, async (req, reply) => {
    const [updated] = await db('projects')
      .where({ id: req.params.id, deleted: false })
      .update({ ...req.body, updated_at: db.fn.now() })
      .returning('*');
    if (!updated) return reply.code(404).send({ error: 'Not found' });
    reply.send(updated);
  });

  // DELETE /api/projects/:id (soft delete)
  fastify.delete('/:id', async (req, reply) => {
    const [updated] = await db('projects')
      .where({ id: req.params.id })
      .update({ deleted: true, updated_at: db.fn.now() })
      .returning('id');
    if (!updated) return reply.code(404).send({ error: 'Not found' });
    reply.send({ success: true });
  });

  // GET /api/projects/:id/xml  — generate TEE XML
  fastify.get('/:id/xml', async (req, reply) => {
    const { generateXML } = await import('../utils/xml-generator.js');
    const project = await db('projects').where({ id: req.params.id }).first();
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
