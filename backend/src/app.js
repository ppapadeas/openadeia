import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';

import errorMonitor from './plugins/error-monitor.js';
import auditHook from './hooks/audit.js';
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
import feesRoute from './routes/fees.js';
import portalRoutes from './routes/portal.js';
import adminRoute from './routes/admin.js';
import tenantRoutes from './routes/tenant.js';
import tenantRoute from './routes/tenant.js';
import { LimitExceededError } from './errors/LimitExceededError.js';
import billingRoutes from './routes/billing.js';

/**
 * Build and return the Fastify app without starting it.
 * Accepts opts.logger = false to silence logs in tests.
 */
export async function buildApp(opts = {}) {
  const isTest = process.env.NODE_ENV === 'test';

  const app = Fastify({
    logger: opts.logger !== undefined
      ? opts.logger
      : isTest
        ? false
        : {
            transport: process.env.NODE_ENV !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          },
  });

  // ── Plugins ─────────────────────────────────────────────────────────
  await app.register(errorMonitor);

  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  });

  await app.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 },
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
  await app.register(feesRoute, { prefix: '/api/fees' });
  await app.register(portalRoutes, { prefix: '/api/portal' });
  await app.register(adminRoute, { prefix: '/api/admin' });
  await app.register(tenantRoute, { prefix: '/api/tenant' });

  // ── Billing (SaaS only) ──────────────────────────────────────────────
  // Register billing routes when SAAS_MODE=true or STRIPE_SECRET_KEY is present.
  // This allows self-hosted installs to run without any Stripe configuration.
  if (process.env.SAAS_MODE === 'true' || process.env.STRIPE_SECRET_KEY) {
    // Webhook needs raw body for Stripe signature verification.
    // We add a content-type parser that stores the raw body buffer on the request.
    app.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer', override: false },
      (req, body, done) => {
        if (req.routeOptions?.config?.rawBody) {
          req.rawBody = body;
          done(null, JSON.parse(body));
        } else {
          done(null, JSON.parse(body));
        }
      }
    );
    await app.register(billingRoutes, { prefix: '/api/billing' });
    app.log.info('Billing routes registered (SAAS_MODE or STRIPE_SECRET_KEY detected)');
  }

  // ── Global error handler for LimitExceededError ──────────────────────
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof LimitExceededError) {
      return reply.code(402).send({
        error: 'Έχετε φτάσει το όριο του πλάνου σας',
        limitType: error.limitType,
        current: error.current,
        max: error.max,
        upgradeRequired: true,
      });
    }
    // Let Fastify handle the rest (preserves status code from thrown errors)
    reply.send(error);
  });

  // ── Health check ────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  return app;
}
