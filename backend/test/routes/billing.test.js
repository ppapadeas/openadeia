/**
 * Billing route tests — /api/billing/*
 *
 * The billing routes are conditionally registered: only when
 * SAAS_MODE=true or STRIPE_SECRET_KEY is set (see app.js).
 *
 * When neither is set, all /api/billing/* routes should 404.
 * When STRIPE_SECRET_KEY is set, routes should be reachable
 * (auth/business errors, not 404).
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
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    count: vi.fn().mockResolvedValue([{ count: '0' }]),
  };
  const mockDb = Object.assign(vi.fn(() => mockChain), {
    fn: { now: vi.fn(() => new Date().toISOString()) },
    transaction: vi.fn(async (cb) => cb(mockChain)),
    raw: vi.fn((sql) => sql),
  });
  return { mockDb, mockChain };
});

vi.mock('../../src/config/database.js', () => ({ default: mockDb }));

// ── Mock the billing service ─────────────────────────────────────────
vi.mock('../../src/services/billing.js', () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  constructWebhookEvent: vi.fn(),
  getTenantByStripeCustomer: vi.fn(),
  updateTenantSubscription: vi.fn(),
  getPlanFromPriceId: vi.fn().mockReturnValue('pro'),
  PRICE_IDS: { pro: 'price_test_pro', enterprise: 'price_test_enterprise' },
  PLAN_LIMITS: {
    self_hosted: { projects_max: -1, storage_max_bytes: -1, team_max: -1 },
    free: { projects_max: 5, storage_max_bytes: 524288000, team_max: 1 },
    pro: { projects_max: 50, storage_max_bytes: 5368709120, team_max: 10 },
    enterprise: { projects_max: -1, storage_max_bytes: -1, team_max: -1 },
  },
}));

import { buildApp } from '../../src/app.js';

const TENANT_USER = {
  id: 1,
  email: 'admin@acme.gr',
  name: 'Admin',
  role: 'admin',
  tenant_id: 5,
  is_superadmin: false,
};

// ── Routes 404 when Stripe is not configured ──────────────────────────
describe('Billing routes — STRIPE not configured', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure Stripe keys are absent
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.SAAS_MODE;
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('GET /api/billing/subscription returns 404 when Stripe not configured', async () => {
    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenant_id: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/subscription',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('POST /api/billing/checkout returns 404 when Stripe not configured', async () => {
    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenant_id: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: { plan: 'pro', success_url: 'https://example.com/ok', cancel_url: 'https://example.com/cancel' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('POST /api/billing/portal returns 404 when Stripe not configured', async () => {
    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenant_id: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/portal',
      headers: { authorization: `Bearer ${token}` },
      payload: { return_url: 'https://example.com/billing' },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Routes are reachable when STRIPE_SECRET_KEY is present ───────────
describe('Billing routes — STRIPE configured', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    delete process.env.STRIPE_SECRET_KEY;
    await app?.close();
  });

  it('GET /api/billing/subscription returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/billing/subscription' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/billing/subscription returns subscription info for authenticated user', async () => {
    // Tenant not found in DB → falls back to self_hosted plan
    mockChain.first.mockResolvedValueOnce(null);

    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenant_id: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/subscription',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      plan: expect.any(String),
      status: expect.any(String),
    });
  });

  it('POST /api/billing/checkout returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      payload: { plan: 'pro', success_url: 'https://example.com/ok', cancel_url: 'https://example.com/cancel' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/billing/checkout creates checkout session for authenticated user', async () => {
    const { createCheckoutSession } = await import('../../src/services/billing.js');
    createCheckoutSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/cs_test', id: 'cs_test_123' });

    // Tenant not found in DB — graceful degradation
    mockChain.first.mockResolvedValueOnce(null);

    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenantId: TENANT_USER.tenant_id, // billing service uses tenantId in JWT
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        plan: 'pro',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      url: expect.stringContaining('stripe.com'),
      session_id: 'cs_test_123',
    });
  });

  it('POST /api/billing/portal returns 400 when no Stripe customer on tenant', async () => {
    // Tenant exists but has no stripe_customer_id
    mockChain.first.mockResolvedValueOnce({ id: TENANT_USER.tenant_id, plan: 'free', stripe_customer_id: null });

    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenantId: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/portal',
      headers: { authorization: `Bearer ${token}` },
      payload: { return_url: 'https://example.com/billing' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: expect.any(String) });
  });

  it('POST /api/billing/webhook returns 400 without stripe-signature header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: '{}',
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: expect.stringContaining('stripe-signature') });
  });
});
