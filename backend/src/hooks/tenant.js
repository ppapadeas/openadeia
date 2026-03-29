/**
 * Tenant Hook — Fastify preHandler
 *
 * Resolves the tenant for each authenticated request.
 * Sets req.tenantId from (in priority order):
 *  1. JWT payload (tid or tenant_id field)       — authenticated user, highest trust
 *  2. Subdomain of the Host header               — e.g. forma.openadeia.gr → lookup by slug
 *  3. X-Tenant-Slug header                       — dev / webhook / API fallback
 *  4. Default tenant (self-hosted single-tenant) — if only one active tenant exists
 *
 * Usage:
 *   fastify.addHook('preHandler', tenantHook)
 *   // or per-route:
 *   fastify.get('/foo', { preHandler: [fastify.authenticate, tenantHook] }, handler)
 *
 * Requires fastify.authenticate to run first (req.user must be set).
 */

import db from '../config/database.js';
import { extractTenantSlug } from '../middleware/subdomain.js';

/**
 * Looks up a tenant by its slug field.
 * Returns the tenant row (with at least .id) or null.
 *
 * @param {string} slug
 * @returns {Promise<{id: string}|null>}
 */
async function findTenantBySlug(slug) {
  if (!slug) return null;
  return db('tenants')
    .where({ slug, status: 'active' })
    .select('id')
    .first() ?? null;
}

/**
 * Inline tenant hook function — use as preHandler after authenticate.
 * @param {import('fastify').FastifyRequest} req
 * @param {import('fastify').FastifyReply} reply
 */
export async function tenantHook(req, reply) {
  try {
    // 1. JWT tenant_id (authenticated user) — highest priority
    const jwtTenantId = req.user?.tenant_id || req.user?.tid;
    if (jwtTenantId) {
      req.tenantId = jwtTenantId;
      return;
    }

    // 2. Subdomain → lookup tenant by slug (e.g. forma.openadeia.gr → slug='forma')
    const subdomainSlug = extractTenantSlug(req);
    if (subdomainSlug) {
      const tenant = await findTenantBySlug(subdomainSlug);
      if (tenant) {
        req.tenantId = tenant.id;
        return;
      }
    }

    // 3. X-Tenant-Slug header (dev / webhook / API fallback)
    //    Note: for localhost the subdomain extractor already returns this header value,
    //    but we handle it explicitly here for non-localhost cases where header is set directly.
    const slugHeader = req.headers['x-tenant-slug'];
    if (slugHeader && slugHeader !== subdomainSlug) {
      const tenant = await findTenantBySlug(slugHeader);
      if (tenant) {
        req.tenantId = tenant.id;
        return;
      }
    }

    // 4. Default tenant — self-hosted single-tenant fallback
    //    If there is exactly one active tenant, use it automatically.
    const tenants = await db('tenants').where({ status: 'active' }).select('id');
    if (tenants.length === 1) {
      req.tenantId = tenants[0].id;
      return;
    }

    // No tenant resolved
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
