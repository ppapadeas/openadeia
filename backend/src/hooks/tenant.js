/**
 * Tenant Hook — Fastify preHandler
 *
 * Resolves the tenant for each authenticated request.
 * Sets req.tenantId from:
 *  1. JWT payload (tid or tenant_id field) — primary source
 *  2. X-Tenant-Slug header — fallback for API/webhook requests
 *
 * Usage:
 *   fastify.addHook('preHandler', tenantHook)
 *   // or per-route:
 *   fastify.get('/foo', { preHandler: [fastify.authenticate, tenantHook] }, handler)
 *
 * Requires fastify.authenticate to run first (req.user must be set).
 */

import db from '../config/database.js';

/**
 * Inline tenant hook function — use as preHandler after authenticate.
 * @param {import('fastify').FastifyRequest} req
 * @param {import('fastify').FastifyReply} reply
 */
export async function tenantHook(req, reply) {
  try {
    // 1. Try JWT payload
    const jwtTenantId = req.user?.tenant_id || req.user?.tid;

    if (jwtTenantId) {
      req.tenantId = jwtTenantId;
      return;
    }

    // 2. Try X-Tenant-Slug header (useful for scripts/webhook testing)
    const slugHeader = req.headers['x-tenant-slug'];
    if (slugHeader) {
      const tenant = await db('tenants')
        .where({ slug: slugHeader, status: 'active' })
        .select('id')
        .first();

      if (tenant) {
        req.tenantId = tenant.id;
        return;
      }
    }

    // 3. No tenant resolved — reject
    reply.code(401).send({ error: 'Tenant not identified' });
  } catch (err) {
    req.log?.error?.({ err }, 'tenantHook error');
    reply.code(500).send({ error: 'Internal error resolving tenant' });
  }
}

/**
 * Fastify plugin that registers the tenant hook as a decorator.
 * Register this in app.js to make fastify.tenantHook available globally.
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function tenantHookPlugin(fastify) {
  // Decorate so routes can use: { preHandler: [fastify.authenticate, fastify.tenantHook] }
  fastify.decorate('tenantHook', tenantHook);

  // Also available as a bound method for use in addHook
  fastify.decorate('resolveTenant', async function resolveTenant(req, reply) {
    return tenantHook(req, reply);
  });
}
