import db from '../config/database.js';

export default async function searchRoute(fastify) {
  // GET /api/search?q=
  fastify.get('/', async (req, reply) => {
    const { q } = req.query;
    if (!q || q.length < 2) return reply.send({ projects: [], clients: [] });

    const [projects, clients] = await Promise.all([
      db('projects as p')
        .leftJoin('clients as c', 'p.client_id', 'c.id')
        .where('p.deleted', false)
        .where(b => b
          .whereILike('p.title', `%${q}%`)
          .orWhereILike('p.code', `%${q}%`)
          .orWhereILike('c.surname', `%${q}%`)
        )
        .select('p.id', 'p.code', 'p.title', 'p.type', 'p.stage',
          db.raw("concat(c.surname, ' ', c.name) as client_name"))
        .limit(10),
      db('clients')
        .where(b => b
          .whereILike('surname', `%${q}%`)
          .orWhereILike('name', `%${q}%`)
          .orWhereILike('afm', `%${q}%`)
        )
        .select('id', 'surname', 'name', 'afm', 'email')
        .limit(10),
    ]);

    reply.send({ projects, clients });
  });
}
