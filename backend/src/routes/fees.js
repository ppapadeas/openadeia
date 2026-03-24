import db from '../config/database.js';
import { calculateFees, calcKH, calcTEE, calcEFKA } from '../services/fee-calculator.js';

export default async function feesRoute(fastify) {

  // GET /api/fees/lambda — all lambda values
  fastify.get('/lambda', async (req, reply) => {
    reply.send(await db('fee_lambda').orderBy('period_code'));
  });

  // GET /api/fees/lambda/current — latest (frozen 20121)
  fastify.get('/lambda/current', async (req, reply) => {
    reply.send(await db('fee_lambda').orderBy('period_code', 'desc').first());
  });

  // POST /api/fees/calculate — stateless calculation (no auth)
  fastify.post('/calculate', async (req, reply) => {
    const { lambdaCode, lambdaValue: explicit, ...rest } = req.body;
    let lambdaValue = explicit;
    if (!lambdaValue && lambdaCode) {
      const row = await db('fee_lambda').where({ period_code: lambdaCode }).first();
      lambdaValue = row?.lambda ?? 0.23368;
    }
    reply.send(calculateFees({ ...rest, lambdaValue: lambdaValue ?? 0.23368 }));
  });

  // POST /api/fees/projects/:id/calculations — save calculation for a project
  fastify.post('/projects/:id/calculations',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const { id: project_id } = req.params;
      const { lambdaCode, lambdaValue: explicit, makeOfficial = false, notes, ...rest } = req.body;

      let lambdaValue = explicit;
      if (!lambdaValue && lambdaCode) {
        const row = await db('fee_lambda').where({ period_code: lambdaCode }).first();
        lambdaValue = row?.lambda ?? 0.23368;
      }
      lambdaValue = lambdaValue ?? 0.23368;

      const result = calculateFees({ ...rest, lambdaValue });

      if (makeOfficial) {
        await db('fee_calculations').where({ project_id }).update({ is_official: false });
      }

      const [calc] = await db('fee_calculations').insert({
        project_id,
        created_by: req.user.id,
        lambda_code: lambdaCode,
        lambda_value: lambdaValue,
        fpa_rate: rest.fpa ?? 24,
        areas: JSON.stringify(rest.areas ?? {}),
        difficulty: JSON.stringify(rest.difficulty ?? {}),
        active_studies: JSON.stringify(rest.studies ?? {}),
        ks_percents: JSON.stringify(rest.ksPercents ?? {}),
        is_demolition: rest.isDemolition ?? false,
        result_p:   result.P,
        result_sa:  result.SA,
        result_se:  result.SE,
        result_sum: result.SUM,
        result_pa1: result.PA1,
        result_p1:  result.P1,
        breakdown:  JSON.stringify(result.breakdown),
        notes,
        is_official: makeOfficial,
      }).returning('*');

      reply.code(201).send({ ...calc, computed: result });
    }
  );

  // GET /api/fees/projects/:id/calculations — list calculations for a project
  fastify.get('/projects/:id/calculations',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      reply.send(
        await db('fee_calculations')
          .where({ project_id: req.params.id })
          .orderBy('created_at', 'desc')
      );
    }
  );

  // GET /api/fees/calculations/:calcId — single calculation
  fastify.get('/calculations/:calcId',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const row = await db('fee_calculations').where({ id: req.params.calcId }).first();
      if (!row) return reply.code(404).send({ error: 'Not found' });
      reply.send(row);
    }
  );
}
