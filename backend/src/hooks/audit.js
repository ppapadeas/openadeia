/**
 * Audit Hook — Fastify onResponse hook
 *
 * Auto-logs write operations (POST, PUT, PATCH, DELETE) after each response.
 * Skips: GET, HEAD, OPTIONS, health check, auth routes, failed requests (5xx).
 *
 * Registration (in app.js):
 *   import auditHook from './hooks/audit.js';
 *   app.addHook('onResponse', auditHook);
 *
 * The hook operates in fire-and-forget mode — it never delays the response.
 */

import { logAction } from '../services/audit.js';

// Methods we care about
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Route prefixes to skip (auth tokens contain sensitive data; health is noise)
const SKIP_PREFIXES = ['/api/auth/', '/health'];

// Map HTTP method + status to an action verb
function inferAction(method, status, _url) {
  if (method === 'DELETE') return 'resource.deleted';
  if (method === 'POST') {
    if (status === 201) return 'resource.created';
    return 'resource.action';
  }
  if (method === 'PUT' || method === 'PATCH') return 'resource.updated';
  return 'resource.write';
}

// Extract the resource type from URL
// e.g. /api/projects/uuid → 'project'
// e.g. /api/clients/uuid/documents → 'document'
function inferResourceType(url) {
  const parts = url.replace(/^\/api\//, '').split('/').filter(Boolean);
  if (parts.length === 0) return null;

  // If last segment looks like a UUID, use second-to-last as resource type
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let resourceSegment = parts[parts.length - 1];
  if (uuidPattern.test(resourceSegment) && parts.length >= 2) {
    resourceSegment = parts[parts.length - 2];
  }

  // Normalise plural → singular
  const singularMap = {
    projects: 'project',
    clients: 'client',
    documents: 'document',
    users: 'user',
    tenants: 'tenant',
    studies: 'study',
    approvals: 'approval',
    fees: 'fee',
    portal: 'portal',
    admin: 'admin',
    tee: 'tee',
    sign: 'sign',
    nok: 'nok',
    search: 'search',
    workflow: 'workflow',
    email: 'email',
    emails: 'email',
  };

  return singularMap[resourceSegment] || resourceSegment;
}

// Extract the resource ID (UUID) from URL path if present
function extractResourceId(url) {
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = url.match(uuidPattern);
  return match ? match[0] : null;
}

/**
 * The onResponse hook function.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export default async function auditHook(request, reply) {
  // Only log write methods
  if (!WRITE_METHODS.has(request.method)) return;

  // Skip certain route prefixes
  const url = request.url || '';
  if (SKIP_PREFIXES.some((prefix) => url.startsWith(prefix))) return;

  // Skip server errors — not user-initiated state changes
  if (reply.statusCode >= 500) return;

  // Skip clearly failed client auth (401, 403 logged separately if needed)
  // Actually we DO want to log 403 attempts on write routes for security audit
  // But skip 400 validation errors — no state changed
  if (reply.statusCode === 400) return;

  // Extract IP
  const forwardedFor = request.headers?.['x-forwarded-for'];
  const ip = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : (request.ip || null);

  const userAgent = request.headers?.['user-agent'] || null;

  // Determine actor
  const user = request.user;
  let actorType = 'api';
  let actorId = null;
  let userId = null;

  if (user?.id) {
    actorType = 'user';
    actorId = user.email || user.id;
    userId = user.id;
  } else if (request.portalClient?.id) {
    actorType = 'portal_client';
    actorId = String(request.portalClient.id);
  }

  const action = inferAction(request.method, reply.statusCode, url);
  const resourceType = inferResourceType(url);
  const resourceId = extractResourceId(url);

  // Fire-and-forget — don't await, never block the response
  logAction(user?.tenant_id || null, {
    actorType,
    actorId,
    userId,
    action,
    resourceType,
    resourceId,
    metadata: {
      method: request.method,
      url: url.split('?')[0], // strip query params
      status: reply.statusCode,
    },
    ip,
    userAgent,
  }).catch((err) => {
    // Already handled in logAction, but just in case
    console.error('[audit-hook] Unhandled error:', err.message);
  });
}
