/**
 * Auth route tests — register, login, /me
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
  };
  const mockDb = Object.assign(vi.fn(() => mockChain), {
    fn: { now: vi.fn(() => new Date().toISOString()) },
  });
  return { mockDb, mockChain };
});

vi.mock('../../src/config/database.js', () => ({ default: mockDb }));

import { buildApp } from '../../src/app.js';
import bcrypt from 'bcryptjs';

const TEST_USER = {
  id: 1,
  email: 'engineer@test.gr',
  name: 'Μηχανικός Δοκιμής',
  role: 'engineer',
  amh: '12345',
  created_at: new Date().toISOString(),
};

describe('POST /api/auth/register', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 409 if email already exists', async () => {
    mockChain.first.mockResolvedValueOnce({ id: 1, email: 'engineer@test.gr' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'engineer@test.gr', name: 'Τεστ', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: expect.stringContaining('email') });
  });

  it('creates user and returns JWT on success', async () => {
    mockChain.first.mockResolvedValueOnce(null); // no existing user
    mockChain.returning.mockResolvedValueOnce([TEST_USER]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'engineer@test.gr', name: 'Μηχανικός', password: 'password123' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe(TEST_USER.email);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'no-password@test.gr' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 for unknown email', async () => {
    mockChain.first.mockResolvedValueOnce(null);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'unknown@test.gr', password: 'any' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correct-pass', 1);
    mockChain.first.mockResolvedValueOnce({ ...TEST_USER, password_hash: hash });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_USER.email, password: 'wrong-pass' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns JWT token on successful login', async () => {
    const hash = await bcrypt.hash('correct-pass', 1);
    mockChain.first.mockResolvedValueOnce({ ...TEST_USER, password_hash: hash });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_USER.email, password: 'correct-pass' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe(TEST_USER.email);
  });
});

describe('GET /api/auth/me', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns user info with valid token', async () => {
    mockChain.first.mockResolvedValueOnce(TEST_USER);
    const token = app.jwt.sign({ id: TEST_USER.id });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email: TEST_USER.email });
  });
});
