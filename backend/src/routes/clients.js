import db from '../config/database.js';
import { createClientSchema, updateClientSchema, zodValidator } from '../middleware/validate.js';

export default async function clientsRoute(fastify) {
  // GET /api/clients
  fastify.get('/', async (req, reply) => {
    const { q } = req.query;
    let query = db('clients').orderBy('surname');
    if (q) query = query.where(b => b.whereILike('surname', `%${q}%`).orWhereILike('name', `%${q}%`).orWhereILike('afm', `%${q}%`));
    reply.send(await query);
  });

  // POST /api/clients
  fastify.post('/', { preHandler: zodValidator(createClientSchema) }, async (req, reply) => {
    const [client] = await db('clients').insert(req.body).returning('*');
    reply.code(201).send(client);
  });

  // GET /api/clients/:id
  fastify.get('/:id', async (req, reply) => {
    const client = await db('clients').where({ id: req.params.id }).first();
    if (!client) return reply.code(404).send({ error: 'Not found' });
    const projects = await db('projects').where({ client_id: req.params.id, deleted: false }).select('id', 'code', 'title', 'type', 'stage');
    reply.send({ ...client, projects });
  });

  // PATCH /api/clients/:id
  fastify.patch('/:id', { preHandler: zodValidator(updateClientSchema) }, async (req, reply) => {
    const [client] = await db('clients').where({ id: req.params.id }).update(req.body).returning('*');
    if (!client) return reply.code(404).send({ error: 'Not found' });
    reply.send(client);
  });
}
