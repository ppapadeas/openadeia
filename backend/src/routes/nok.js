import { getRules, getChecklist, getAllTypes } from '../services/nok-rules.js';

export default async function nokRoute(fastify) {
  // GET /api/nok/types
  fastify.get('/types', async (_req, reply) => {
    reply.send(getAllTypes());
  });

  // GET /api/nok/rules/:type
  fastify.get('/rules/:type', async (req, reply) => {
    try {
      reply.send(getRules(req.params.type));
    } catch {
      reply.code(404).send({ error: 'Unknown permit type' });
    }
  });

  // GET /api/nok/checklist/:type
  fastify.get('/checklist/:type', async (req, reply) => {
    try {
      reply.send(getChecklist(req.params.type));
    } catch {
      reply.code(404).send({ error: 'Unknown permit type' });
    }
  });
}
