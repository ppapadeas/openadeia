import db from '../config/database.js';
import { advanceStage, rejectToStage } from '../services/workflow-engine.js';
import { rejectSchema, zodValidator } from '../middleware/validate.js';

export default async function workflowRoute(fastify) {
  // POST /api/projects/:id/advance
  fastify.post('/:id/advance', async (req, reply) => {
    const userId = req.body?.userId || null;
    const result = await advanceStage(req.params.id, userId);
    if (!result.advanced) {
      return reply.code(422).send({ error: 'Cannot advance', reason: result.reason, missing: result.missing });
    }
    reply.send(result);
  });

  // POST /api/projects/:id/reject
  fastify.post('/:id/reject', { preHandler: zodValidator(rejectSchema) }, async (req, reply) => {
    const { targetStage, reason } = req.body;
    const userId = req.body?.userId || null;
    await rejectToStage(req.params.id, targetStage, reason, userId);
    reply.send({ success: true });
  });

  // GET /api/projects/:id/timeline
  fastify.get('/:id/timeline', async (req, reply) => {
    const logs = await db('workflow_logs as wl')
      .leftJoin('users as u', 'wl.user_id', 'u.id')
      .where({ 'wl.project_id': req.params.id })
      .select('wl.*', 'u.name as user_name')
      .orderBy('wl.created_at', 'asc');
    reply.send(logs);
  });
}
