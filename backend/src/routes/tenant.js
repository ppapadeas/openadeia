/**
 * Tenant Routes — /api/tenant/*
 *
 * GDPR compliance endpoints for the current tenant (self-hosted / single-tenant).
 * All routes require: authenticated + role === 'admin' (or is_superadmin).
 *
 * Routes:
 *   GET  /api/tenant/export      — Full GDPR data export as JSON download
 *   DELETE /api/tenant           — Tenant self-deletion (requires confirmation)
 *   GET  /api/tenant/audit       — Audit log viewer (paginated)
 */

import db from '../config/database.js';
import { logAction } from '../services/audit.js';
import { getUsageStats, getCurrentTenantId } from '../services/usage.js';

/**
 * requireAdmin — preHandler that allows tenant admins OR superadmins.
 */
async function requireAdmin(request, reply) {
  const user = request.user;
  if (!user) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  if (user.role !== 'admin' && !user.is_superadmin) {
    return reply.code(403).send({ error: 'Forbidden', detail: 'Admin role required' });
  }
}

export default async function tenantRoutes(fastify) {
  const adminAuth = {
    onRequest: [fastify.authenticate],
    preHandler: [requireAdmin],
  };

  // ── GET /api/tenant/usage ───────────────────────────────────────────
  // Returns current usage vs plan limits. Requires authentication (any role).
  fastify.get('/usage', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const tenantId = getCurrentTenantId();
    const stats = await getUsageStats(tenantId);
    reply.send({ data: stats });
  });

  // ── GET /api/tenant/export ──────────────────────────────────────────
  // Full GDPR data export for the tenant as a JSON download.
  // Includes: projects, clients, documents metadata, users, audit_log (last 10000).
  fastify.get('/export', adminAuth, async (req, reply) => {
    const userId = req.user.id;
    const tenantId = req.user?.tenant_id || null;

    // Log the export action
    await logAction(tenantId, {
      actorType: 'user',
      actorId: req.user.email || userId,
      userId,
      action: 'tenant.data_export',
      resourceType: 'tenant',
      metadata: { requested_by: req.user.email },
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Gather all tenant data
    const [projects, clients, documents, users, auditLog] = await Promise.all([
      db('projects')
        .select(
          'id', 'code', 'title', 'type', 'stage', 'progress',
          'client_id', 'created_by', 'created_at', 'updated_at',
          'deadline', 'tee_permit_code', 'tee_submission_date',
          'aitisi_type_code', 'yd_id', 'dimos_aa', 'aitisi_descr',
          'entos_sxediou', 'notes', 'deleted'
        )
        .orderBy('created_at', 'asc'),

      db('clients')
        .select(
          'id', 'surname', 'name', 'father_name', 'email',
          'phone', 'mobile', 'afm', 'adt', 'address', 'city', 'zip_code',
          'owner_type', 'created_at'
        )
        .orderBy('created_at', 'asc'),

      // Documents: metadata only, no file content
      db('documents')
        .select(
          'id', 'project_id', 'doc_type', 'label', 'status',
          'file_size', 'file_hash', 'mime_type', 'signer_role',
          'signed_at', 'uploaded_at', 'uploaded_by', 'notes'
        )
        // file_path omitted — internal storage path, not user data
        .orderBy('uploaded_at', 'asc'),

      db('users')
        .select('id', 'email', 'name', 'role', 'amh', 'is_superadmin', 'created_at')
        .orderBy('created_at', 'asc'),

      (() => {
        let q = db('audit_log')
          .select(
            'id', 'actor_type', 'actor_id', 'user_id', 'action',
            'resource_type', 'resource_id', 'metadata',
            db.raw('ip_address::text'),
            'user_agent', 'created_at'
          )
          .orderBy('created_at', 'desc')
          .limit(10000);
        if (tenantId) {
          q = q.where('tenant_id', tenantId);
        } else {
          q = q.whereNull('tenant_id');
        }
        return q;
      })(),
    ]);

    const exportData = {
      export_meta: {
        exported_at: new Date().toISOString(),
        exported_by: req.user.email,
        platform: 'OpenAdeia',
        version: '2.0.0',
        schema_version: '008',
        note: 'This export contains all data associated with your OpenAdeia installation. Produced for GDPR compliance.',
      },
      statistics: {
        projects: projects.length,
        clients: clients.length,
        documents: documents.length,
        users: users.length,
        audit_entries: auditLog.length,
      },
      users,
      clients,
      projects,
      documents,
      audit_log: auditLog,
    };

    const filename = `openadeia-export-${new Date().toISOString().slice(0, 10)}.json`;

    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(exportData);
  });

  // ── DELETE /api/tenant ──────────────────────────────────────────────
  // Tenant self-deletion. Cascade-deletes all data via DB foreign keys.
  // Requires body: { confirm: 'DELETE MY DATA' }
  fastify.delete('/', adminAuth, async (req, reply) => {
    const { confirm } = req.body || {};

    if (confirm !== 'DELETE MY DATA') {
      return reply.code(400).send({
        error: 'Confirmation required',
        detail: 'Send { "confirm": "DELETE MY DATA" } in the request body to proceed.',
      });
    }

    const userId = req.user.id;
    const userEmail = req.user.email;
    const tenantId = req.user?.tenant_id || null;

    // Log deletion event BEFORE deleting (so it's in the record)
    await logAction(tenantId, {
      actorType: 'user',
      actorId: userEmail || userId,
      userId,
      action: 'tenant.deleted',
      resourceType: 'tenant',
      metadata: {
        deleted_by: userEmail,
        confirmed_at: new Date().toISOString(),
      },
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Delete all data — cascade order respects FK constraints
    // (Most tables reference projects/clients/users with CASCADE, so order matters for base tables)
    await db.transaction(async (trx) => {
      // Child tables first (cascade would handle most, but explicit is safer)
      await trx('audit_log').delete();
      await trx('workflow_logs').delete();
      await trx('emails').delete();
      await trx('doc_rights').delete();
      await trx('prev_praxis').delete();
      await trx('approvals').delete();
      await trx('documents').delete();
      await trx('ekdosi').delete();
      await trx('properties').delete();
      await trx('projects').delete();
      await trx('clients').delete();
      // Delete all non-superadmin users (keep superadmin for system integrity)
      await trx('users').where('is_superadmin', false).delete();
    });

    reply.send({
      success: true,
      message: 'All tenant data has been permanently deleted.',
      deleted_at: new Date().toISOString(),
    });
  });

  // ── GET /api/tenant/audit ───────────────────────────────────────────
  // Paginated audit log viewer.
  fastify.get('/audit', adminAuth, async (req, reply) => {
    const { limit = 100, offset = 0, action, resource_type, user_id } = req.query;

    const parsedLimit = Math.min(parseInt(limit, 10) || 100, 500);
    const parsedOffset = parseInt(offset, 10) || 0;

    // Scope to the current user's tenant (or null for legacy single-tenant data)
    const tenantId = req.user?.tenant_id || null;

    let query = db('audit_log')
      .select(
        'audit_log.id',
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
        'users.name as user_name',
        'users.email as user_email',
      )
      .leftJoin('users', 'audit_log.user_id', 'users.id')
      .orderBy('audit_log.created_at', 'desc')
      .limit(parsedLimit)
      .offset(parsedOffset);

    // Filter by tenant
    if (tenantId) {
      query = query.where('audit_log.tenant_id', tenantId);
    } else {
      query = query.whereNull('audit_log.tenant_id');
    }

    if (action) query = query.where('audit_log.action', action);
    if (resource_type) query = query.where('audit_log.resource_type', resource_type);
    if (user_id) query = query.where('audit_log.user_id', user_id);

    // Count query with same tenant filter
    let countQuery = db('audit_log');
    if (tenantId) {
      countQuery = countQuery.where('tenant_id', tenantId);
    } else {
      countQuery = countQuery.whereNull('tenant_id');
    }

    const [entries, [{ count }]] = await Promise.all([
      query,
      countQuery.count('id as count'),
    ]);

    reply.send({
      data: entries,
      meta: {
        total: parseInt(count, 10),
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  });
}
