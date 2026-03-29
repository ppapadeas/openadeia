/**
 * Audit Service
 *
 * Provides structured logging of all state-changing operations.
 * GDPR-compliant by design — every log entry has actor, timestamp, resource.
 *
 * Usage:
 *   import { logAction, logFromRequest } from './audit.js';
 *
 *   // Direct call
 *   await logAction(null, {
 *     actorType: 'user',
 *     userId: req.user.id,
 *     action: 'project.created',
 *     resourceType: 'project',
 *     resourceId: project.id,
 *   });
 *
 *   // From a Fastify request
 *   await logFromRequest(req, 'document.uploaded', 'document', doc.id, { size: 1234 });
 */

import db from '../config/database.js';

/**
 * Log a single audit event.
 *
 * @param {string|null} tenantId  - UUID of the tenant (null for single-tenant / system events)
 * @param {object} opts
 * @param {string} opts.actorType       - 'user' | 'portal_client' | 'system' | 'api'
 * @param {string} [opts.actorId]       - string ID of the actor (email, client ref, etc.)
 * @param {string} [opts.userId]        - UUID of the user row (if actor is a user)
 * @param {string} opts.action          - Event name, e.g. 'project.created', 'document.signed'
 * @param {string} [opts.resourceType]  - 'project' | 'document' | 'client' | 'user' | etc.
 * @param {string} [opts.resourceId]    - UUID of the affected resource
 * @param {object} [opts.metadata]      - Extra context (before/after state, etc.)
 * @param {string} [opts.ip]            - IPv4 or IPv6 address string
 * @param {string} [opts.userAgent]     - User-Agent header value
 * @returns {Promise<void>}
 */
export async function logAction(tenantId, {
  actorType,
  actorId,
  userId,
  action,
  resourceType,
  resourceId,
  metadata,
  ip,
  userAgent,
} = {}) {
  try {
    await db('audit_log').insert({
      tenant_id: tenantId || null,
      actor_type: actorType || 'system',
      actor_id: actorId || null,
      user_id: userId || null,
      action,
      resource_type: resourceType || null,
      resource_id: resourceId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ip_address: ip || null,
      user_agent: userAgent || null,
    });
  } catch (err) {
    // Never let audit failures crash the main request
    console.error('[audit] Failed to write audit log entry:', err.message, { action, actorType });
  }
}

/**
 * Convenience helper — log from an authenticated Fastify request.
 *
 * Extracts user info, IP, and User-Agent automatically.
 * Falls back gracefully if req.user is not set (portal / system calls).
 *
 * @param {import('fastify').FastifyRequest} req
 * @param {string} action
 * @param {string} [resourceType]
 * @param {string} [resourceId]
 * @param {object} [metadata]
 */
export async function logFromRequest(req, action, resourceType, resourceId, metadata) {
  const user = req.user;

  // Determine actor type
  let actorType = 'api';
  let actorId = null;

  if (user?.id) {
    actorType = 'user';
    actorId = user.email || user.id;
  } else if (req.portalClient?.id) {
    actorType = 'portal_client';
    actorId = req.portalClient.id;
  }

  // Extract IP: check x-forwarded-for (reverse proxy), fall back to req.ip
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const ip = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : (req.ip || null);

  const userAgent = req.headers?.['user-agent'] || null;

  await logAction(user?.tenant_id || null, {
    actorType,
    actorId,
    userId: user?.id || null,
    action,
    resourceType: resourceType || null,
    resourceId: resourceId || null,
    metadata,
    ip,
    userAgent,
  });
}

/**
 * Query audit log entries for a tenant with pagination.
 *
 * @param {string|null} tenantId
 * @param {object} opts
 * @param {number} [opts.limit=100]
 * @param {number} [opts.offset=0]
 * @param {string} [opts.action]        - filter by action
 * @param {string} [opts.resourceType]  - filter by resource_type
 * @param {string} [opts.userId]        - filter by user_id
 * @returns {Promise<object[]>}
 */
export async function queryAuditLog(tenantId, {
  limit = 100,
  offset = 0,
  action,
  resourceType,
  userId,
} = {}) {
  let query = db('audit_log')
    .select(
      'audit_log.id',
      'audit_log.tenant_id',
      'audit_log.actor_type',
      'audit_log.actor_id',
      'audit_log.user_id',
      'audit_log.action',
      'audit_log.resource_type',
      'audit_log.resource_id',
      'audit_log.metadata',
      db.raw('audit_log.ip_address::text'),
      'audit_log.user_agent',
      'audit_log.created_at',
      // Join user name for display
      'users.name as user_name',
      'users.email as user_email',
    )
    .leftJoin('users', 'audit_log.user_id', 'users.id')
    .orderBy('audit_log.created_at', 'desc')
    .limit(Math.min(limit, 1000))
    .offset(offset);

  // Filter by tenant
  if (tenantId) {
    query = query.where('audit_log.tenant_id', tenantId);
  } else {
    query = query.whereNull('audit_log.tenant_id');
  }

  if (action) query = query.where('audit_log.action', action);
  if (resourceType) query = query.where('audit_log.resource_type', resourceType);
  if (userId) query = query.where('audit_log.user_id', userId);

  return query;
}
