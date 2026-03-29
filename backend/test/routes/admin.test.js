/**
 * Admin route tests — /api/admin/tenants, /api/admin/tenants/:id, /api/admin/metrics
 * All routes require is_superadmin = true in the JWT.
 */
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

// ── Mock the database ────────────────────────────────────────────────
const { mockDb, mockChain } = vi.hoisted(() => {
  const mockChain = {
    where: vi.fn().mockReturnThis(),
    whereNull: vi.fn().mockReturnThis(),
    whereILike: vi.fn().mockReturnThis(),
    orWhereILike: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockResolvedValue(1),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    count: vi.fn().mockResolvedValue([{ count: '0' }]),
    sum: vi.fn().mockResolvedValue([{ total: 0 }]),
    groupBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };
  const mockDb = Object.assign(vi.fn(() => mockChain), {
    fn: { now: vi.fn(() => new Date().toISOString()) },
    transaction: vi.fn(async (cb) => cb(mockChain)),
    raw: vi.fn((sql) => sql),
    schema: { hasTable: vi.fn().mockResolvedValue(false) },
  });
  return { mockDb, mockChain };
});

vi.mock('../../src/config/database.js', () => ({ default: mockDb }));

import { buildApp } from '../../src/app.js';

// ── Test fixtures ─────────────────────────────────────────────────────
const SUPERADMIN = {
  id: 1,
  email: 'superadmin@openadeia.gr',
  name: 'Super Admin',
  role: 'admin',
  tenant_id: null,
  is_superadmin: true,
};

const REGULAR_USER = {
  id: 2,
  email: 'engineer@acme.gr',
  name: 'Engineer',
  role: 'engineer',
  tenant_id: 5,
  is_superadmin: false,
};

const TENANT_ADMIN = {
  id: 3,
  email: 'admin@acme.gr',
  name: 'Tenant Admin',
  role: 'admin',
  tenant_id: 5,
  is_superadmin: false,
};

// ── GET /api/admin/tenants ────────────────────────────────────────────
describe('GET /api/admin/tenants', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb.schema.hasTable.mockResolvedValue(false);
    mockChain.count.mockResolvedValue([{ count: '10' }]);
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/tenants' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for regular engineer user', async () => {
    const token = app.jwt.sign({
      id: REGULAR_USER.id,
      email: REGULAR_USER.email,
      role: REGULAR_USER.role,
      tenant_id: REGULAR_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for tenant admin (non-superadmin)', async () => {
    const token = app.jwt.sign({
      id: TENANT_ADMIN.id,
      email: TENANT_ADMIN.email,
      role: TENANT_ADMIN.role,
      tenant_id: TENANT_ADMIN.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns synthetic fallback tenant list when tenants table is absent', async () => {
    mockDb.schema.hasTable.mockResolvedValue(false);

    const token = app.jwt.sign({
      id: SUPERADMIN.id,
      email: SUPERADMIN.email,
      role: SUPERADMIN.role,
      tenant_id: SUPERADMIN.tenant_id,
      is_superadmin: true,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({ total: expect.any(Number) });
    // Fallback synthetic tenant
    expect(body.data[0]).toMatchObject({ id: 'default', status: 'active' });
  });

  it('queries real tenants table with aggregated counts when table exists', async () => {
    mockDb.schema.hasTable.mockResolvedValue(true);

    const fakeTenant = {
      id: 'tenant-uuid-1',
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'pro',
      status: 'active',
      created_at: new Date().toISOString(),
      project_count: '3',
      user_count: '5',
      storage_used: '102400',
    };

    // Promise.all: first resolves with tenant rows, second with count
    mockChain.offset
      .mockResolvedValueOnce([fakeTenant])  // tenant rows query
    mockChain.count.mockResolvedValueOnce([{ count: '1' }]);  // total count query

    const token = app.jwt.sign({
      id: SUPERADMIN.id,
      email: SUPERADMIN.email,
      role: SUPERADMIN.role,
      tenant_id: SUPERADMIN.tenant_id,
      is_superadmin: true,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants?limit=25&offset=0',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({
      total: 1,
      limit: 25,
      offset: 0,
    });
    // Must NOT be the fallback synthetic tenant
    expect(body.data[0]).not.toMatchObject({ id: 'default' });
    // Should have used leftJoin for JOIN query
    expect(mockChain.leftJoin).toHaveBeenCalled();
  });

  it('supports pagination query params', async () => {
    mockDb.schema.hasTable.mockResolvedValue(false);
    mockChain.count.mockResolvedValue([{ count: '5' }]);

    const token = app.jwt.sign({
      id: SUPERADMIN.id,
      email: SUPERADMIN.email,
      role: SUPERADMIN.role,
      tenant_id: SUPERADMIN.tenant_id,
      is_superadmin: true,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants?limit=10&offset=20',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta).toMatchObject({ limit: 10, offset: 20 });
  });
});

// ── GET /api/admin/tenants/:id ────────────────────────────────────────
describe('GET /api/admin/tenants/:id', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockChain.count.mockResolvedValue([{ count: '5' }]);
    mockChain.orderBy.mockResolvedValue([]); // users list
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/tenants/default' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for non-superadmin', async () => {
    const token = app.jwt.sign({
      id: REGULAR_USER.id,
      email: REGULAR_USER.email,
      role: REGULAR_USER.role,
      tenant_id: REGULAR_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants/default',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns tenant detail for superadmin (default tenant)', async () => {
    const token = app.jwt.sign({
      id: SUPERADMIN.id,
      email: SUPERADMIN.email,
      role: SUPERADMIN.role,
      tenant_id: SUPERADMIN.tenant_id,
      is_superadmin: true,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants/default',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toMatchObject({
      id: 'default',
      status: 'active',
      users: expect.any(Array),
    });
  });

  it('returns 404 for unknown tenant id', async () => {
    const token = app.jwt.sign({
      id: SUPERADMIN.id,
      email: SUPERADMIN.email,
      role: SUPERADMIN.role,
      tenant_id: SUPERADMIN.tenant_id,
      is_superadmin: true,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants/does-not-exist',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── GET /api/admin/metrics ────────────────────────────────────────────
describe('GET /api/admin/metrics', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset orderBy to non-resolving (previous describe block sets orderBy.mockResolvedValue)
    mockChain.orderBy.mockReturnThis();
    // count() is terminal for simple scalar count queries
    mockChain.count.mockResolvedValue([{ count: '42' }]);
    // groupBy() is terminal for aggregate breakdown queries (count is in raw select via db.raw)
    mockChain.groupBy.mockResolvedValue([]);
    // limit() is terminal for recentProjectsList
    mockChain.limit.mockResolvedValue([]);
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/metrics' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for non-superadmin', async () => {
    const token = app.jwt.sign({
      id: TENANT_ADMIN.id,
      email: TENANT_ADMIN.email,
      role: TENANT_ADMIN.role,
      tenant_id: TENANT_ADMIN.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/metrics',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns platform metrics for superadmin', async () => {
    const token = app.jwt.sign({
      id: SUPERADMIN.id,
      email: SUPERADMIN.email,
      role: SUPERADMIN.role,
      tenant_id: SUPERADMIN.tenant_id,
      is_superadmin: true,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/metrics',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toMatchObject({
      total_tenants: expect.any(Number),
      total_users: expect.any(Number),
      total_projects: expect.any(Number),
      total_documents: expect.any(Number),
      computed_at: expect.any(String),
    });
  });

  it('metrics response contains 30-day activity fields', async () => {
    const token = app.jwt.sign({
      id: SUPERADMIN.id,
      email: SUPERADMIN.email,
      role: SUPERADMIN.role,
      tenant_id: SUPERADMIN.tenant_id,
      is_superadmin: true,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/metrics',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data).toHaveProperty('new_projects_30d');
    expect(data).toHaveProperty('new_users_30d');
    expect(data).toHaveProperty('projects_by_stage');
    expect(data).toHaveProperty('projects_by_type');
    expect(data).toHaveProperty('recent_projects');
  });
});
