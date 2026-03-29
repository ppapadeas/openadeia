/**
 * Admin Routes — /api/admin/*
 *
 * Platform-level superadmin endpoints for managing tenants and viewing metrics.
 * All routes require: authenticated + is_superadmin = true
 *
 * Phase 6 foundational implementation — single-tenant for now, but structured
 * to support multi-tenancy once the tenants table exists.
 */

import db from '../config/database.js';
import requireSuperadmin from '../middleware/requireSuperadmin.js';

export default async function adminRoute(fastify) {
  // All admin routes require auth + superadmin
  const authAndAdmin = { onRequest: [fastify.authenticate], preHandler: [requireSuperadmin] };

  // ── GET /api/admin/tenants ─────────────────────────────────────────
  // List all tenants with usage stats from the tenants table.
  // Falls back to a synthetic single-tenant entry when the tenants table
  // doesn't exist yet (self-hosted installations without migration 008).
  fastify.get('/tenants', authAndAdmin, async (req, reply) => {
    const { limit = 50, offset = 0 } = req.query;
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 500);
    const parsedOffset = parseInt(offset, 10) || 0;

    const hasTenantsTable = await db.schema?.hasTable('tenants').catch(() => false) ?? false;

    if (hasTenantsTable) {
      // Real multi-tenant mode: single aggregated query with JOIN counts
      const [tenants, [{ count }]] = await Promise.all([
        db('tenants as t')
          .select(
            't.id',
            't.name',
            't.slug',
            't.plan',
            't.status',
            't.created_at',
            db.raw('COUNT(DISTINCT p.id) as project_count'),
            db.raw('COUNT(DISTINCT u.id) as user_count'),
            db.raw('COALESCE(SUM(d.file_size), 0) as storage_used'),
          )
          .leftJoin('projects as p', 'p.tenant_id', 't.id')
          .leftJoin('users as u', 'u.tenant_id', 't.id')
          .leftJoin('documents as d', 'd.project_id', 'p.id')
          .groupBy('t.id')
          .orderBy('t.created_at', 'desc')
          .limit(parsedLimit)
          .offset(parsedOffset),
        db('tenants').count('id as count'),
      ]);

      return reply.send({
        data: tenants,
        meta: { total: parseInt(count, 10), limit: parsedLimit, offset: parsedOffset },
      });
    }

    // Fallback: self-hosted single-tenant — synthesise from raw counts
    const [projectCount] = await db('projects').count('id as count');
    const [userCount] = await db('users').count('id as count');
    const [clientCount] = await db('clients').count('id as count');

    const tenants = [
      {
        id: 'default',
        name: 'Default Tenant',
        plan: process.env.TENANT_PLAN || 'self_hosted',
        status: 'active',
        projects_count: parseInt(projectCount.count, 10),
        users_count: parseInt(userCount.count, 10),
        clients_count: parseInt(clientCount.count, 10),
        storage_used_bytes: 0,
        created_at: null,
      },
    ];

    reply.send({ data: tenants, meta: { total: tenants.length, limit: parsedLimit, offset: parsedOffset } });
  });

  // ── GET /api/admin/tenants/:id ─────────────────────────────────────
  // Get detailed info on a specific tenant.
  fastify.get('/tenants/:id', authAndAdmin, async (req, reply) => {
    const { id } = req.params;

    // Phase 6: Only 'default' tenant exists
    if (id !== 'default') {
      return reply.code(404).send({ error: 'Tenant not found' });
    }

    const [projectCount] = await db('projects').count('id as count');
    const [userCount] = await db('users').count('id as count');
    const [clientCount] = await db('clients').count('id as count');
    const [docCount] = await db('documents').count('id as count');
    const [feeCount] = await db('fee_calculations').count('id as count');

    // Get users list for this tenant
    const users = await db('users')
      .select('id', 'email', 'name', 'role', 'is_superadmin', 'created_at')
      .orderBy('created_at', 'asc');

    const tenant = {
      id: 'default',
      name: 'Default Tenant',
      plan: process.env.TENANT_PLAN || 'self_hosted',
      status: 'active',
      projects_count: parseInt(projectCount.count, 10),
      users_count: parseInt(userCount.count, 10),
      clients_count: parseInt(clientCount.count, 10),
      documents_count: parseInt(docCount.count, 10),
      fee_calculations_count: parseInt(feeCount.count, 10),
      storage_used_bytes: 0,
      users,
      created_at: null,
    };

    reply.send({ data: tenant });
  });

  // ── PATCH /api/admin/tenants/:id ───────────────────────────────────
  // Update tenant plan/status/limits.
  // Phase 6: Accepts the update but only persists via env/config for now.
  fastify.patch('/tenants/:id', authAndAdmin, async (req, reply) => {
    const { id } = req.params;

    if (id !== 'default') {
      return reply.code(404).send({ error: 'Tenant not found' });
    }

    const { plan, status, limits } = req.body || {};
    const allowed_plans = ['free', 'pro', 'enterprise', 'self_hosted'];
    const allowed_statuses = ['active', 'suspended', 'trialing', 'past_due'];

    if (plan && !allowed_plans.includes(plan)) {
      return reply.code(400).send({ error: `Invalid plan. Must be one of: ${allowed_plans.join(', ')}` });
    }
    if (status && !allowed_statuses.includes(status)) {
      return reply.code(400).send({ error: `Invalid status. Must be one of: ${allowed_statuses.join(', ')}` });
    }

    // Phase 6: No tenants table yet — acknowledge but note manual config needed
    // When tenants table is added (Phase 4), this will do a real DB update
    fastify.log.info({ tenant_id: id, plan, status, limits }, 'Admin: tenant update requested');

    reply.send({
      data: {
        id,
        plan: plan || process.env.TENANT_PLAN || 'self_hosted',
        status: status || 'active',
        limits: limits || null,
        _note: 'Phase 6: Multi-tenancy not yet fully implemented. Updates acknowledged but require manual config until tenants table is added.',
      },
    });
  });

  // ── GET /api/admin/metrics ─────────────────────────────────────────
  // Platform-level dashboard metrics.
  fastify.get('/metrics', authAndAdmin, async (req, reply) => {
    const [projects] = await db('projects').count('id as count');
    const [users] = await db('users').count('id as count');
    const [superadmins] = await db('users').where({ is_superadmin: true }).count('id as count');
    const [clients] = await db('clients').count('id as count');
    const [documents] = await db('documents').count('id as count');
    const [fees] = await db('fee_calculations').count('id as count');

    // Recent activity — last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentProjects] = await db('projects')
      .where('created_at', '>=', thirtyDaysAgo)
      .count('id as count');

    const [recentUsers] = await db('users')
      .where('created_at', '>=', thirtyDaysAgo)
      .count('id as count');

    // Project stage breakdown — use raw count in select, chain ends with .groupBy()
    const stageBreakdown = await db('projects')
      .select('stage', db.raw('count(id) as count'))
      .orderBy('count', 'desc')
      .groupBy('stage');

    // Project type breakdown — same pattern
    const typeBreakdown = await db('projects')
      .select('type', db.raw('count(id) as count'))
      .orderBy('count', 'desc')
      .groupBy('type');

    // Recent projects (last 5)
    const recentProjectsList = await db('projects')
      .select('id', 'code', 'title', 'type', 'stage', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(5);

    const metrics = {
      // Totals
      total_tenants: 1,
      active_tenants: 1,
      total_users: parseInt(users.count, 10),
      superadmin_users: parseInt(superadmins.count, 10),
      total_projects: parseInt(projects.count, 10),
      total_clients: parseInt(clients.count, 10),
      total_documents: parseInt(documents.count, 10),
      total_fee_calculations: parseInt(fees.count, 10),

      // Last 30 days
      new_projects_30d: parseInt(recentProjects.count, 10),
      new_users_30d: parseInt(recentUsers.count, 10),

      // Breakdowns
      projects_by_stage: stageBreakdown,
      projects_by_type: typeBreakdown,

      // Recent activity
      recent_projects: recentProjectsList,

      // SaaS metrics (placeholders for when billing is added)
      mrr_eur: 0,
      arr_eur: 0,

      // Meta
      computed_at: new Date().toISOString(),
      platform_version: '2.0.0-phase6',
    };

    reply.send({ data: metrics });
  });

  // ── GET /api/admin/users ───────────────────────────────────────────
  // List all users across all tenants with pagination.
  fastify.get('/users', authAndAdmin, async (req, reply) => {
    const { limit = 100, offset = 0, tenant_id, role, search } = req.query;
    const parsedLimit = Math.min(parseInt(limit, 10) || 100, 500);
    const parsedOffset = parseInt(offset, 10) || 0;

    let query = db('users')
      .select(
        'users.id',
        'users.email',
        'users.name',
        'users.role',
        'users.is_superadmin',
        'users.tenant_id',
        'users.created_at',
        'users.updated_at',
      )
      .orderBy('users.created_at', 'desc')
      .limit(parsedLimit)
      .offset(parsedOffset);

    // Optional: join tenant name if tenants table exists
    const hasTenantsTable = await db.schema?.hasTable('tenants').catch(() => false) ?? false;
    if (hasTenantsTable) {
      query = db('users')
        .select(
          'users.id',
          'users.email',
          'users.name',
          'users.role',
          'users.is_superadmin',
          'users.tenant_id',
          'tenants.name as tenant_name',
          'tenants.plan as tenant_plan',
          'users.created_at',
          'users.updated_at',
        )
        .leftJoin('tenants', 'users.tenant_id', 'tenants.id')
        .orderBy('users.created_at', 'desc')
        .limit(parsedLimit)
        .offset(parsedOffset);
    }

    if (tenant_id) query = query.where('users.tenant_id', tenant_id);
    if (role) query = query.where('users.role', role);
    if (search) {
      query = query.where((builder) => {
        builder
          .whereILike('users.email', `%${search}%`)
          .orWhereILike('users.name', `%${search}%`);
      });
    }

    let countQuery = db('users');
    if (tenant_id) countQuery = countQuery.where('tenant_id', tenant_id);
    if (role) countQuery = countQuery.where('role', role);
    if (search) {
      countQuery = countQuery.where((builder) => {
        builder
          .whereILike('email', `%${search}%`)
          .orWhereILike('name', `%${search}%`);
      });
    }

    const [users, [{ count }]] = await Promise.all([
      query,
      countQuery.count('id as count'),
    ]);

    reply.send({
      data: users,
      meta: {
        total: parseInt(count, 10),
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  });

  // ── GET /api/admin/audit-logs ──────────────────────────────────────
  // Global audit log view across all tenants, with filtering.
  fastify.get('/audit-logs', authAndAdmin, async (req, reply) => {
    const {
      limit = 100,
      offset = 0,
      tenant_id,
      action,
      resource_type,
      user_id,
      from,
      to,
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit, 10) || 100, 500);
    const parsedOffset = parseInt(offset, 10) || 0;

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
        'users.name as user_name',
        'users.email as user_email',
      )
      .leftJoin('users', 'audit_log.user_id', 'users.id')
      .orderBy('audit_log.created_at', 'desc')
      .limit(parsedLimit)
      .offset(parsedOffset);

    // No tenant scoping — this is a global view (superadmin only)
    if (tenant_id) query = query.where('audit_log.tenant_id', tenant_id);
    if (action) query = query.where('audit_log.action', action);
    if (resource_type) query = query.where('audit_log.resource_type', resource_type);
    if (user_id) query = query.where('audit_log.user_id', user_id);
    if (from) query = query.where('audit_log.created_at', '>=', new Date(from));
    if (to) query = query.where('audit_log.created_at', '<=', new Date(to));

    let countQuery = db('audit_log');
    if (tenant_id) countQuery = countQuery.where('tenant_id', tenant_id);
    if (action) countQuery = countQuery.where('action', action);
    if (resource_type) countQuery = countQuery.where('resource_type', resource_type);
    if (user_id) countQuery = countQuery.where('user_id', user_id);
    if (from) countQuery = countQuery.where('created_at', '>=', new Date(from));
    if (to) countQuery = countQuery.where('created_at', '<=', new Date(to));

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
