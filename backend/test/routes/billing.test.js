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

  // ── GET /subscription — detailed scenarios ──────────────────────────

  it('GET /api/billing/subscription returns plan limits', async () => {
    mockChain.first.mockResolvedValueOnce({
      id: TENANT_USER.tenant_id,
      plan: 'pro',
      subscription_status: 'active',
      stripe_customer_id: 'cus_test123',
      stripe_subscription_id: 'sub_test123',
      subscription_period_end: null,
    });

    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenantId: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/subscription',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plan).toBe('pro');
    expect(body.status).toBe('active');
    expect(body.limits).toBeDefined();
    expect(body.limits).toHaveProperty('projects_max');
    expect(body.limits).toHaveProperty('storage_max_bytes');
    expect(body.limits).toHaveProperty('team_max');
    expect(body.stripe_customer_id).toBe('cus_test123');
    expect(body.subscription_id).toBe('sub_test123');
  });

  it('GET /api/billing/subscription returns self_hosted plan when DB has no tenant', async () => {
    mockChain.first.mockResolvedValueOnce(null);

    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenantId: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/subscription',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plan).toBe('self_hosted');
    expect(body.limits.projects_max).toBe(-1);
    expect(body.stripe_customer_id).toBeNull();
  });

  // ── POST /checkout — additional scenarios ───────────────────────────

  it('POST /api/billing/checkout returns 400 for invalid plan', async () => {
    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenantId: TENANT_USER.tenant_id,
      is_superadmin: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        plan: 'free',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      },
    });

    // 'free' is not in the allowed enum (only 'pro' and 'enterprise')
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/billing/checkout returns 502 when Stripe throws', async () => {
    const { createCheckoutSession } = await import('../../src/services/billing.js');
    createCheckoutSession.mockRejectedValueOnce(new Error('Stripe API down'));

    mockChain.first.mockResolvedValueOnce({ id: TENANT_USER.tenant_id, email: 'admin@acme.gr' });

    const token = app.jwt.sign({
      id: TENANT_USER.id,
      email: TENANT_USER.email,
      role: TENANT_USER.role,
      tenantId: TENANT_USER.tenant_id,
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

    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'Stripe API down' });
  });

  // ── POST /portal — additional scenarios ─────────────────────────────

  it('POST /api/billing/portal creates session when stripe_customer_id exists', async () => {
    const { createPortalSession } = await import('../../src/services/billing.js');
    createPortalSession.mockResolvedValueOnce({ url: 'https://billing.stripe.com/session/bps_test' });

    mockChain.first.mockResolvedValueOnce({
      id: TENANT_USER.tenant_id,
      plan: 'pro',
      stripe_customer_id: 'cus_test123',
    });

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

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      url: expect.stringContaining('stripe.com'),
    });
  });

  it('POST /api/billing/portal returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/portal',
      payload: { return_url: 'https://example.com/billing' },
    });
    expect(res.statusCode).toBe(401);
  });

  // ── POST /webhook — event handler scenarios ──────────────────────────

  it('POST /api/billing/webhook returns 400 for invalid signature', async () => {
    const { constructWebhookEvent } = await import('../../src/services/billing.js');
    constructWebhookEvent.mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: '{"type":"checkout.session.completed"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=invalid,v1=badsig',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: expect.stringContaining('verification failed') });
  });

  it('POST /api/billing/webhook handles checkout.session.completed', async () => {
    const { constructWebhookEvent, updateTenantSubscription } = await import('../../src/services/billing.js');

    constructWebhookEvent.mockReturnValueOnce({
      id: 'evt_test_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          client_reference_id: String(TENANT_USER.tenant_id),
          customer: 'cus_new_test',
          subscription: 'sub_new_test',
          line_items: null,
        },
      },
    });
    updateTenantSubscription.mockResolvedValueOnce();

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: '{"type":"checkout.session.completed"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1234,v1=valid',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
    expect(updateTenantSubscription).toHaveBeenCalledWith(
      String(TENANT_USER.tenant_id),
      expect.objectContaining({
        stripe_customer_id: 'cus_new_test',
        stripe_subscription_id: 'sub_new_test',
        subscription_status: 'active',
      })
    );
  });

  it('POST /api/billing/webhook handles customer.subscription.updated', async () => {
    const { constructWebhookEvent, updateTenantSubscription, getTenantByStripeCustomer } = await import('../../src/services/billing.js');

    constructWebhookEvent.mockReturnValueOnce({
      id: 'evt_test_sub_updated',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test123',
          status: 'active',
          customer: 'cus_test123',
          current_period_end: 1800000000,
          metadata: { tenant_id: String(TENANT_USER.tenant_id) },
          items: { data: [{ price: { id: 'price_test_pro' } }] },
        },
      },
    });
    updateTenantSubscription.mockResolvedValueOnce();

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: '{"type":"customer.subscription.updated"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1234,v1=valid',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
    expect(updateTenantSubscription).toHaveBeenCalledWith(
      String(TENANT_USER.tenant_id),
      expect.objectContaining({
        subscription_status: 'active',
        stripe_subscription_id: 'sub_test123',
      })
    );
  });

  it('POST /api/billing/webhook handles customer.subscription.deleted (downgrade to free)', async () => {
    const { constructWebhookEvent, updateTenantSubscription, getTenantByStripeCustomer } = await import('../../src/services/billing.js');

    constructWebhookEvent.mockReturnValueOnce({
      id: 'evt_test_sub_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test123',
          customer: 'cus_test123',
          metadata: { tenant_id: String(TENANT_USER.tenant_id) },
        },
      },
    });
    updateTenantSubscription.mockResolvedValueOnce();

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: '{"type":"customer.subscription.deleted"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1234,v1=valid',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
    expect(updateTenantSubscription).toHaveBeenCalledWith(
      String(TENANT_USER.tenant_id),
      expect.objectContaining({
        plan: 'free',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
      })
    );
  });

  it('POST /api/billing/webhook handles invoice.payment_failed (marks past_due)', async () => {
    const { constructWebhookEvent, updateTenantSubscription, getTenantByStripeCustomer } = await import('../../src/services/billing.js');

    constructWebhookEvent.mockReturnValueOnce({
      id: 'evt_test_payment_failed',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_test123',
          customer: 'cus_test123',
          subscription_details: {
            metadata: { tenant_id: String(TENANT_USER.tenant_id) },
          },
        },
      },
    });
    updateTenantSubscription.mockResolvedValueOnce();

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: '{"type":"invoice.payment_failed"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1234,v1=valid',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
    expect(updateTenantSubscription).toHaveBeenCalledWith(
      String(TENANT_USER.tenant_id),
      { subscription_status: 'past_due' }
    );
  });

  it('POST /api/billing/webhook returns 200 even when handler throws (Stripe retry prevention)', async () => {
    const { constructWebhookEvent, updateTenantSubscription } = await import('../../src/services/billing.js');

    constructWebhookEvent.mockReturnValueOnce({
      id: 'evt_test_error',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_error',
          client_reference_id: String(TENANT_USER.tenant_id),
          customer: 'cus_error',
          subscription: 'sub_error',
          line_items: null,
        },
      },
    });
    // Simulate handler failure
    updateTenantSubscription.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: '{"type":"checkout.session.completed"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1234,v1=valid',
      },
    });

    // Must return 200 even on internal errors (prevent Stripe retries)
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
  });

  it('POST /api/billing/webhook handles unknown event types gracefully', async () => {
    const { constructWebhookEvent } = await import('../../src/services/billing.js');

    constructWebhookEvent.mockReturnValueOnce({
      id: 'evt_test_unknown',
      type: 'some.unknown.event',
      data: { object: {} },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: '{"type":"some.unknown.event"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1234,v1=valid',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
  });
});
