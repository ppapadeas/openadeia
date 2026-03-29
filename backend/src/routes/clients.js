import db from '../config/database.js';
import { createClientSchema, updateClientSchema, zodValidator } from '../middleware/validate.js';
import { tenantHook } from '../hooks/tenant.js';

export default async function clientsRoute(fastify) {
  // Shared preHandler: authenticate + resolve tenant
  const auth = [fastify.authenticate, tenantHook];

  // GET /api/clients
  fastify.get('/', { onRequest: auth }, async (req, reply) => {
    const { q } = req.query;
    const tenantId = req.tenantId;
    let query = db('clients').where({ tenant_id: tenantId }).orderBy('surname');
    if (q) query = query.where(b => b.whereILike('surname', `%${q}%`).orWhereILike('name', `%${q}%`).orWhereILike('afm', `%${q}%`));
    reply.send(await query);
  });

  // POST /api/clients
  fastify.post('/', { onRequest: auth, preHandler: zodValidator(createClientSchema) }, async (req, reply) => {
    const tenantId = req.tenantId;
    const [client] = await db('clients').insert({ ...req.body, tenant_id: tenantId }).returning('*');
    reply.code(201).send(client);
  });

  // GET /api/clients/:id
  fastify.get('/:id', { onRequest: auth }, async (req, reply) => {
    const tenantId = req.tenantId;
    const client = await db('clients').where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!client) return reply.code(404).send({ error: 'Not found' });
    const projects = await db('projects').where({ client_id: req.params.id, tenant_id: tenantId, deleted: false }).select('id', 'code', 'title', 'type', 'stage');
    reply.send({ ...client, projects });
  });

  // PATCH /api/clients/:id
  fastify.patch('/:id', { onRequest: auth, preHandler: zodValidator(updateClientSchema) }, async (req, reply) => {
    const tenantId = req.tenantId;
    const [client] = await db('clients').where({ id: req.params.id, tenant_id: tenantId }).update(req.body).returning('*');
    if (!client) return reply.code(404).send({ error: 'Not found' });
    reply.send(client);
  });
}
