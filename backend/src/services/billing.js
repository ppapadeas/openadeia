/**
 * Billing Service — Stripe Integration
 *
 * Handles Stripe checkout sessions, billing portal, subscription management.
 * Safe to import even when STRIPE_SECRET_KEY is not set — methods will throw
 * a clear error instead of crashing at startup.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY        - sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET    - whsec_... (for webhook signature verification)
 *   STRIPE_PRICE_PRO         - Stripe Price ID for the Pro plan
 *   STRIPE_PRICE_ENTERPRISE  - Stripe Price ID for the Enterprise plan
 */

import Stripe from 'stripe';
import db from '../config/database.js';

// ── Stripe client (lazy init) ──────────────────────────────────────────────
let _stripe = null;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is not configured. ' +
      'Set it in .env to enable billing features.'
    );
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });
  }
  return _stripe;
}

// ── Price ID constants ─────────────────────────────────────────────────────
export const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO || null,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || null,
};

// Maps Stripe Price IDs → plan names
export function getPlanFromPriceId(priceId) {
  if (priceId === PRICE_IDS.pro) return 'pro';
  if (priceId === PRICE_IDS.enterprise) return 'enterprise';
  return 'free';
}

// ── Plan limits ────────────────────────────────────────────────────────────
export const PLAN_LIMITS = {
  free: {
    projects_max: 5,
    storage_max_bytes: 500 * 1024 * 1024,   // 500 MB
    team_max: 1,
    api_calls_per_day: 0,
  },
  pro: {
    projects_max: -1,                         // unlimited
    storage_max_bytes: 10 * 1024 * 1024 * 1024, // 10 GB
    team_max: 3,
    api_calls_per_day: 0,
  },
  enterprise: {
    projects_max: -1,
    storage_max_bytes: -1,                    // unlimited
    team_max: -1,
    api_calls_per_day: 10000,
  },
  self_hosted: {
    projects_max: -1,
    storage_max_bytes: -1,
    team_max: -1,
    api_calls_per_day: -1,
  },
};

// ── Checkout session ───────────────────────────────────────────────────────
/**
 * Create a Stripe Checkout session for a tenant upgrading to a plan.
 *
 * @param {object} tenant - Tenant row from DB (id, email, stripe_customer_id, …)
 * @param {string} priceId - Stripe Price ID
 * @param {string} successUrl - URL to redirect after successful payment
 * @param {string} cancelUrl  - URL to redirect if user cancels
 * @returns {Promise<Stripe.Checkout.Session>}
 */
export async function createCheckoutSession(tenant, priceId, successUrl, cancelUrl) {
  const stripe = getStripe();

  const params = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Carry tenant ID so webhook can match it back
    client_reference_id: String(tenant.id),
    subscription_data: {
      metadata: { tenant_id: String(tenant.id) },
    },
  };

  // Re-use existing Stripe customer if we already have one
  if (tenant.stripe_customer_id) {
    params.customer = tenant.stripe_customer_id;
  } else if (tenant.email) {
    params.customer_email = tenant.email;
  }

  return stripe.checkout.sessions.create(params);
}

// ── Billing portal session ─────────────────────────────────────────────────
/**
 * Create a Stripe Customer Portal session for self-service subscription management.
 *
 * @param {object} tenant - Tenant row (stripe_customer_id required)
 * @param {string} returnUrl - URL to return to after portal
 * @returns {Promise<Stripe.BillingPortal.Session>}
 */
export async function createPortalSession(tenant, returnUrl) {
  const stripe = getStripe();

  if (!tenant.stripe_customer_id) {
    throw new Error('Tenant has no Stripe customer ID. Complete checkout first.');
  }

  return stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: returnUrl,
  });
}

// ── Webhook event construction (signature-verified) ────────────────────────
/**
 * Construct and verify a Stripe webhook event from raw request body + signature.
 *
 * @param {Buffer} rawBody   - Raw request body (must be Buffer, not parsed JSON)
 * @param {string} signature - Value of stripe-signature header
 * @returns {Stripe.Event}
 */
export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not configured. ' +
      'Set it in .env to enable webhook verification.'
    );
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

// ── DB helpers ─────────────────────────────────────────────────────────────
/**
 * Fetch tenant row by ID or stripe_customer_id.
 * Returns null when not found (caller should 404 or skip).
 */
export async function getTenantByStripeCustomer(stripeCustomerId) {
  // Multi-tenancy (tenants table) — fallback to users table for self-hosted
  try {
    const tenant = await db('tenants')
      .where({ stripe_customer_id: stripeCustomerId })
      .first();
    return tenant || null;
  } catch {
    // tenants table may not exist in early / self-hosted installs
    return null;
  }
}

export async function updateTenantSubscription(tenantId, fields) {
  try {
    await db('tenants').where({ id: tenantId }).update(fields);
  } catch {
    // Silently skip in self-hosted installs without tenants table
  }
}
