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
  // List all tenants with usage stats.
  // Phase 6: Until multi-tenancy is fully implemented, returns a synthetic
  // single-tenant entry derived from actual database counts.
  fastify.get('/tenants', authAndAdmin, async (req, reply) => {
    const [projectCount] = await db('projects').count('id as count');
    const [userCount] = await db('users').count('id as count');
    const [clientCount] = await db('clients').count('id as count');

    // Synthetic single tenant entry representing the current installation
    const tenants = [
      {
        id: 'default',
        name: 'Default Tenant',
        plan: process.env.TENANT_PLAN || 'self_hosted',
        status: 'active',
        projects_count: parseInt(projectCount.count, 10),
        users_count: parseInt(userCount.count, 10),
        clients_count: parseInt(clientCount.count, 10),
        storage_used_bytes: 0, // TODO: query MinIO when storage tracking is added
        created_at: null,
      },
    ];

    reply.send({ data: tenants, meta: { total: tenants.length } });
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

    // Project stage breakdown
    const stageBreakdown = await db('projects')
      .select('stage')
      .count('id as count')
      .groupBy('stage')
      .orderBy('count', 'desc');

    // Project type breakdown
    const typeBreakdown = await db('projects')
      .select('type')
      .count('id as count')
      .groupBy('type')
      .orderBy('count', 'desc');

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
}
