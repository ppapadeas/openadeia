import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';

import authRoute from './routes/auth.js';
import projectsRoute from './routes/projects.js';
import documentsRoute from './routes/documents.js';
import studiesRoute from './routes/studies.js';
import workflowRoute from './routes/workflow.js';
import nokRoute from './routes/nok.js';
import emailRoute from './routes/email.js';
import signRoute from './routes/sign.js';
import clientsRoute from './routes/clients.js';
import searchRoute from './routes/search.js';
import teeRoute from './routes/tee.js';

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// ── Plugins ─────────────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
});

await app.register(multipart, {
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

await app.register(rateLimit, {
  max: 200,
  timeWindow: '1 minute',
});

// ── JWT authenticate decorator ───────────────────────────────────────
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Δεν είστε συνδεδεμένος', detail: err.message });
  }
});

// ── Routes ──────────────────────────────────────────────────────────
await app.register(authRoute, { prefix: '/api/auth' });
await app.register(projectsRoute, { prefix: '/api/projects' });
await app.register(documentsRoute, { prefix: '/api/projects' });
await app.register(studiesRoute, { prefix: '/api/projects' });
await app.register(workflowRoute, { prefix: '/api/projects' });
await app.register(emailRoute, { prefix: '/api/projects' });
await app.register(nokRoute, { prefix: '/api/nok' });
await app.register(signRoute, { prefix: '/api/sign' });
await app.register(clientsRoute, { prefix: '/api/clients' });
await app.register(searchRoute, { prefix: '/api/search' });
await app.register(teeRoute, { prefix: '/api/tee' });

// ── Health check ────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

// ── Start ───────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Server listening on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
