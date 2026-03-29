/**
 * Tenant route tests — /api/tenant/usage, /api/tenant/audit, /api/tenant/export
 */
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

// ── Mock the database ────────────────────────────────────────────────
const { mockDb, mockChain } = vi.hoisted(() => {
  const mockChain = {
    where: vi.fn().mockReturnThis(),
    whereNull: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockResolvedValue(1),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    count: vi.fn().mockResolvedValue([{ count: '0' }]),
    sum: vi.fn().mockResolvedValue([{ total: 0 }]),
  };
  const mockDb = Object.assign(vi.fn(() => mockChain), {
    fn: { now: vi.fn(() => new Date().toISOString()) },
    transaction: vi.fn(async (cb) => cb(mockChain)),
    raw: vi.fn((sql) => sql),
  });
  return { mockDb, mockChain };
});

vi.mock('../../src/config/database.js', () => ({ default: mockDb }));

// ── Mock audit service (used by /export) ─────────────────────────────
vi.mock('../../src/services/audit.js', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
  logFromRequest: vi.fn().mockResolvedValue(undefined),
}));

import { buildApp } from '../../src/app.js';

// ── Mock reset helper ──────────────────────────────────────────────
// vi.resetAllMocks() clears implementations; re-apply defaults after calling it.
function restoreMockChainDefaults() {
  // Restore mockDb so it returns mockChain when called as db('tablename')
  mockDb.mockReturnValue(mockChain);
  // Restore mockDb static properties cleared by vi.resetAllMocks()
  if (!mockDb.transaction || !mockDb.transaction.mock) {
    mockDb.transaction = vi.fn(async (cb) => cb(mockChain));
  } else {
    mockDb.transaction.mockImplementation(async (cb) => cb(mockChain));
  }
  if (!mockDb.raw || !mockDb.raw.mock) {
    mockDb.raw = vi.fn((sql) => sql);
  } else {
    mockDb.raw.mockImplementation((sql) => sql);
  }
  // Restore chain method defaults
  mockChain.where.mockReturnThis();
  mockChain.whereNull.mockReturnThis();
  mockChain.select.mockReturnThis();
  mockChain.insert.mockReturnThis();
  mockChain.update.mockReturnThis();
  mockChain.delete.mockReturnThis();
  mockChain.orderBy.mockReturnThis();
  mockChain.limit.mockReturnThis();
  mockChain.offset.mockReturnThis();
  mockChain.leftJoin.mockReturnThis();
  mockChain.first.mockResolvedValue(null);
  mockChain.returning.mockResolvedValue([]);
  mockChain.count.mockResolvedValue([{ count: '0' }]);
  mockChain.sum.mockResolvedValue([{ total: 0 }]);
}

// ── Helpers ────────────────────────────────────────────────────────
const TENANT_USER = {
  id: 1,
  email: 'admin@tenant.gr',
  name: 'Tenant Admin',
  role: 'admin',
  tenant_id: 5,
  is_superadmin: false,
};

const REGULAR_USER = {
  id: 2,
  email: 'engineer@tenant.gr',
  name: 'Engineer',
  role: 'engineer',
  tenant_id: 5,
  is_superadmin: false,
};

// ── GET /api/tenant/usage ─────────────────────────────────────────────
describe('GET /api/tenant/usage', () => {
  let app;

  beforeEach(async () => {
    vi.resetAllMocks();
    restoreMockChainDefaults();
    mockChain.count.mockResolvedValue([{ count: '3' }]);
    mockChain.sum.mockResolvedValue([{ total: 10240 }]);
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tenant/usage' });
    expect(res.statusCode).toBe(401);
  });

  it('returns usage stats for authenticated user', async () => {
    const token = app.jwt.sign({
      id: REGULAR_USER.id,
      email: REGULAR_USER.email,
      role: REGULAR_USER.role,
      tenant_id: REGULAR_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tenant/usage',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.plan).toBeDefined();
    expect(body.data.projects).toBeDefined();
    expect(body.data.storage).toBeDefined();
  });

  it('returns usage stats for admin user', async () => {
    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenant_id: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tenant/usage',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveProperty('plan');
  });
});

// ── GET /api/tenant/audit ─────────────────────────────────────────────
describe('GET /api/tenant/audit', () => {
  let app;

  beforeEach(async () => {
    vi.resetAllMocks();
    restoreMockChainDefaults();
    // audit log query ends with .limit().offset() — offset() is terminal
    mockChain.offset.mockResolvedValue([]);
    mockChain.count.mockResolvedValue([{ count: '0' }]);
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tenant/audit' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const token = app.jwt.sign({
      id: REGULAR_USER.id,
      email: REGULAR_USER.email,
      role: REGULAR_USER.role,
      tenant_id: REGULAR_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tenant/audit',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns audit log for admin user', async () => {
    // Mock the entire chain for audit log query → returns empty array (offset/limit call)
    mockChain.offset.mockResolvedValue([]);
    mockChain.count.mockResolvedValue([{ count: '0' }]);

    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenant_id: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tenant/audit',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({
      total: expect.any(Number),
      limit: expect.any(Number),
      offset: expect.any(Number),
    });
  });

  it('accepts pagination query params', async () => {
    mockChain.offset.mockResolvedValue([]);
    mockChain.count.mockResolvedValue([{ count: '0' }]);

    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenant_id: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tenant/audit?limit=50&offset=10',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().meta.limit).toBe(50);
    expect(res.json().meta.offset).toBe(10);
  });
});

// ── GET /api/tenant/export ────────────────────────────────────────────
describe('GET /api/tenant/export', () => {
  let app;

  beforeEach(async () => {
    vi.resetAllMocks();
    restoreMockChainDefaults();

    // The export handler runs 5 queries in Promise.all, all need to resolve to [].
    // Queries end with: projects/clients/documents/users → .orderBy()
    //                   audit_log IIFE → .orderBy().limit() (limit is terminal)
    // Make .orderBy() return a thenable stub that also supports .limit():
    const emptyResult = [];
    const thenableWithLimit = {
      limit: vi.fn(() => Promise.resolve(emptyResult)),
      then: (onFulfilled, onRejected) => Promise.resolve(emptyResult).then(onFulfilled, onRejected),
    };
    mockChain.orderBy.mockReturnValue(thenableWithLimit);
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tenant/export' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const token = app.jwt.sign({
      id: REGULAR_USER.id,
      email: REGULAR_USER.email,
      role: REGULAR_USER.role,
      tenant_id: REGULAR_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tenant/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns JSON export with correct structure for admin user', async () => {
    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenant_id: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tenant/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('openadeia-export');

    const body = res.json();
    expect(body.export_meta).toBeDefined();
    expect(body.export_meta.platform).toBe('OpenAdeia');
    expect(body.statistics).toBeDefined();
    expect(Array.isArray(body.projects)).toBe(true);
    expect(Array.isArray(body.users)).toBe(true);
    expect(Array.isArray(body.clients)).toBe(true);
    expect(Array.isArray(body.documents)).toBe(true);
    expect(Array.isArray(body.audit_log)).toBe(true);
  });
});
