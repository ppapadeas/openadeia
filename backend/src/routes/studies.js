import db from '../config/database.js';

export default async function studiesRoute(fastify) {
  // GET /api/projects/:id/studies
  fastify.get('/:id/studies', async (req, reply) => {
    // Studies are documents with doc_type matching study IDs from NOK rules
    const { getRules } = await import('../services/nok-rules.js');
    const project = await db('projects').where({ id: req.params.id }).first();
    if (!project) return reply.code(404).send({ error: 'Not found' });

    const rules = getRules(project.type);
    const studyIds = rules.requiredStudies.map(s => s.id);

    const docs = await db('documents')
      .where({ project_id: req.params.id })
      .whereIn('doc_type', studyIds);

    const studyMap = Object.fromEntries(docs.map(d => [d.doc_type, d]));

    const studies = rules.requiredStudies.map(s => ({
      ...s,
      ...(studyMap[s.id] || { status: 'not_started' }),
    }));

    reply.send(studies);
  });

  // PATCH /api/projects/:id/studies/:sid
  fastify.patch('/:id/studies/:sid', async (req, reply) => {
    const { status, notes } = req.body;
    const [doc] = await db('documents')
      .where({ project_id: req.params.id, doc_type: req.params.sid })
      .update({ status, notes })
      .returning('*');

    if (!doc) {
      // Create record if not exists
      const [created] = await db('documents').insert({
        project_id: req.params.id,
        doc_type: req.params.sid,
        status: status || 'in_progress',
        notes,
      }).returning('*');
      return reply.send(created);
    }
    reply.send(doc);
  });
}
