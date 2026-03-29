/**
 * Auth v2 route tests — signup-org, forgot-password, reset-password, verify-email
 */
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

// ── Mock the database ────────────────────────────────────────────────
const { mockDb, mockChain } = vi.hoisted(() => {
  const mockChain = {
    where: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockResolvedValue(1),
  };
  const mockDb = Object.assign(vi.fn(() => mockChain), {
    fn: { now: vi.fn(() => new Date().toISOString()) },
    transaction: vi.fn(async (cb) => cb(mockChain)),
    raw: vi.fn((sql) => sql),
  });
  return { mockDb, mockChain };
});

vi.mock('../../src/config/database.js', () => ({ default: mockDb }));

// ── Mock the email queue (non-blocking, fire-and-forget) ─────────────
vi.mock('../../src/jobs/email-queue.js', () => ({
  queueEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock demo seeder (non-blocking) ──────────────────────────────────
vi.mock('../../src/services/demo-seeder.js', () => ({
  seedDemoTenant: vi.fn().mockResolvedValue(undefined),
}));

import { buildApp } from '../../src/app.js';

// ── Test fixtures ─────────────────────────────────────────────────────
const TENANT = {
  id: 10,
  slug: 'acme-architects',
  name: 'Acme Architects',
  plan: 'free',
  status: 'trialing',
  trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
};

const ADMIN_USER = {
  id: 42,
  email: 'admin@acme.gr',
  name: 'Admin Acme',
  role: 'admin',
  tenant_id: TENANT.id,
  created_at: new Date().toISOString(),
};

// ── POST /api/auth/signup-org ─────────────────────────────────────────
describe('POST /api/auth/signup-org', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('creates tenant + admin user and returns JWT on success', async () => {
    // No existing user with this email
    mockChain.first.mockResolvedValueOnce(null);
    // uniqueSlug check — no existing tenant with slug
    mockChain.first.mockResolvedValueOnce(null);
    // insert tenant → returning
    mockChain.returning.mockResolvedValueOnce([TENANT]);
    // insert user → returning
    mockChain.returning.mockResolvedValueOnce([ADMIN_USER]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup-org',
      payload: {
        email: 'admin@acme.gr',
        name: 'Admin Acme',
        password: 'secret123',
        orgName: 'Acme Architects',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe(ADMIN_USER.email);
    expect(body.user.role).toBe('admin');
    expect(body.tenant.slug).toBe(TENANT.slug);
  });

  it('returns 409 if email already exists', async () => {
    mockChain.first.mockResolvedValueOnce({ id: 1, email: 'admin@acme.gr' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup-org',
      payload: {
        email: 'admin@acme.gr',
        name: 'Admin',
        password: 'secret123',
        orgName: 'Acme',
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: expect.stringContaining('email') });
  });

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup-org',
      payload: { email: 'admin@acme.gr' }, // missing name, password, orgName
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup-org',
      payload: {
        email: 'admin@acme.gr',
        name: 'Admin',
        password: '123', // too short
        orgName: 'Acme',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('always returns 200 with generic message (prevents email enumeration)', async () => {
    // Unknown email — user not found
    mockChain.first.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'nobody@example.gr' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBeTruthy();
  });

  it('sends reset email and returns 200 for known email', async () => {
    mockChain.first.mockResolvedValueOnce({ ...ADMIN_USER, password_hash: 'hash' });
    // update call
    mockChain.update.mockResolvedValueOnce(1);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: ADMIN_USER.email },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBeTruthy();
  });

  it('returns 400 for missing email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── POST /api/auth/reset-password ────────────────────────────────────
describe('POST /api/auth/reset-password', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('resets password with valid token and returns success message', async () => {
    mockChain.first.mockResolvedValueOnce({ ...ADMIN_USER, password_reset_token: 'valid-token' });
    mockChain.update.mockResolvedValueOnce(1);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'valid-token', password: 'newpassword123' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBeTruthy();
  });

  it('returns 400 for invalid or expired token', async () => {
    mockChain.first.mockResolvedValueOnce(null); // token not found / expired

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'bad-token', password: 'newpassword123' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 for missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'some-token' }, // missing password
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── POST /api/auth/verify-email ───────────────────────────────────────
describe('POST /api/auth/verify-email', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('verifies email with valid token and returns success message', async () => {
    mockChain.first.mockResolvedValueOnce({ ...ADMIN_USER, email_verify_token: 'valid-verify-token' });
    mockChain.update.mockResolvedValueOnce(1);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: 'valid-verify-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBeTruthy();
  });

  it('returns 400 for invalid token', async () => {
    mockChain.first.mockResolvedValueOnce(null); // token not found

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: 'bogus-token' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 for missing token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
