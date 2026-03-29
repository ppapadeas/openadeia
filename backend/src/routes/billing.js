/**
 * Billing Routes — /api/billing/*
 *
 * SaaS-only endpoints for subscription management via Stripe.
 * Only registered when SAAS_MODE=true or STRIPE_SECRET_KEY is present.
 *
 * Routes:
 *   GET  /api/billing/subscription  — Current subscription status
 *   POST /api/billing/checkout      — Create Stripe Checkout session
 *   POST /api/billing/portal        — Create Stripe Billing Portal session
 *   POST /api/billing/webhook       — Stripe webhook receiver (no auth, sig-verified)
 *
 * ⚠️  The /webhook route MUST receive the raw body (not parsed JSON).
 *     It is registered with rawBody: true and skips JWT auth intentionally.
 */

import db from '../config/database.js';
import {
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  getTenantByStripeCustomer,
  updateTenantSubscription,
  getPlanFromPriceId,
  PRICE_IDS,
  PLAN_LIMITS,
} from '../services/billing.js';

export default async function billingRoutes(fastify) {
  // ── GET /subscription ────────────────────────────────────────────────────
  // Returns the current tenant's subscription status, plan, and limits.
  fastify.get(
    '/subscription',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const { tenantId } = req.user;

      let tenant = null;
      try {
        tenant = await db('tenants').where({ id: tenantId }).first();
      } catch {
        // tenants table not yet available (self-hosted / early install)
      }

      if (!tenant) {
        // Fallback: return self_hosted plan for installations without tenants table
        return reply.send({
          plan: 'self_hosted',
          status: 'active',
          limits: PLAN_LIMITS.self_hosted,
          stripe_customer_id: null,
          subscription_id: null,
          current_period_end: null,
        });
      }

      return reply.send({
        plan: tenant.plan || 'free',
        status: tenant.subscription_status || 'active',
        limits: PLAN_LIMITS[tenant.plan] || PLAN_LIMITS.free,
        stripe_customer_id: tenant.stripe_customer_id || null,
        subscription_id: tenant.stripe_subscription_id || null,
        current_period_end: tenant.subscription_period_end || null,
      });
    }
  );

  // ── POST /checkout ───────────────────────────────────────────────────────
  // Creates a Stripe Checkout session and returns the redirect URL.
  fastify.post(
    '/checkout',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['plan', 'success_url', 'cancel_url'],
          properties: {
            plan:        { type: 'string', enum: ['pro', 'enterprise'] },
            success_url: { type: 'string', format: 'uri' },
            cancel_url:  { type: 'string', format: 'uri' },
          },
        },
      },
    },
    async (req, reply) => {
      const { plan, success_url, cancel_url } = req.body;
      const { tenantId, email } = req.user;

      const priceId = PRICE_IDS[plan];
      if (!priceId) {
        return reply.code(400).send({
          error: `No Stripe Price ID configured for plan '${plan}'. ` +
                 `Set STRIPE_PRICE_${plan.toUpperCase()} in .env.`,
        });
      }

      // Fetch tenant (gracefully degrade if table missing)
      let tenant = { id: tenantId, email };
      try {
        const row = await db('tenants').where({ id: tenantId }).first();
        if (row) tenant = row;
      } catch { /* ok */ }

      let session;
      try {
        session = await createCheckoutSession(tenant, priceId, success_url, cancel_url);
      } catch (err) {
        req.log.error({ err }, 'Stripe checkout error');
        return reply.code(502).send({ error: err.message });
      }

      return reply.send({ url: session.url, session_id: session.id });
    }
  );

  // ── POST /portal ─────────────────────────────────────────────────────────
  // Creates a Stripe Customer Portal session for self-service billing management.
  fastify.post(
    '/portal',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['return_url'],
          properties: {
            return_url: { type: 'string', format: 'uri' },
          },
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user;
      const { return_url } = req.body;

      let tenant = null;
      try {
        tenant = await db('tenants').where({ id: tenantId }).first();
      } catch { /* ok */ }

      if (!tenant || !tenant.stripe_customer_id) {
        return reply.code(400).send({
          error: 'No active Stripe subscription found. Complete checkout first.',
        });
      }

      let portalSession;
      try {
        portalSession = await createPortalSession(tenant, return_url);
      } catch (err) {
        req.log.error({ err }, 'Stripe portal error');
        return reply.code(502).send({ error: err.message });
      }

      return reply.send({ url: portalSession.url });
    }
  );

  // ── POST /webhook ────────────────────────────────────────────────────────
  // Stripe sends signed events here. Must use raw body for signature verification.
  // No JWT auth — Stripe authenticates via HMAC signature.
  fastify.post(
    '/webhook',
    {
      config: { rawBody: true },
      // Stripe webhook must NOT be rate-limited aggressively — skip if possible
    },
    async (req, reply) => {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      // Get raw body — Fastify rawBody plugin stores it as req.rawBody
      const rawBody = req.rawBody;
      if (!rawBody) {
        req.log.error('Stripe webhook: rawBody not available. Ensure rawBody plugin is enabled.');
        return reply.code(500).send({ error: 'Raw body unavailable' });
      }

      let event;
      try {
        event = constructWebhookEvent(rawBody, signature);
      } catch (err) {
        req.log.warn({ err }, 'Stripe webhook signature verification failed');
        return reply.code(400).send({ error: `Webhook verification failed: ${err.message}` });
      }

      req.log.info({ type: event.type, id: event.id }, 'Stripe webhook received');

      try {
        await handleWebhookEvent(event, req.log);
      } catch (err) {
        req.log.error({ err, eventType: event.type }, 'Stripe webhook handler error');
        // Return 200 to prevent Stripe from retrying on app errors
        // (processing errors should be handled internally)
      }

      return reply.send({ received: true });
    }
  );
}

// ── Webhook event dispatcher ───────────────────────────────────────────────
async function handleWebhookEvent(event, log) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object, log);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, log);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, log);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object, log);
      break;

    default:
      log.debug({ type: event.type }, 'Unhandled Stripe event type (ignored)');
  }
}

// ── checkout.session.completed ─────────────────────────────────────────────
// Customer completed checkout → store stripe_customer_id + subscription_id
async function handleCheckoutCompleted(session, log) {
  const tenantId = session.client_reference_id;
  if (!tenantId) {
    log.warn({ session_id: session.id }, 'checkout.session.completed: missing client_reference_id');
    return;
  }

  const updates = {};
  if (session.customer)     updates.stripe_customer_id = session.customer;
  if (session.subscription) updates.stripe_subscription_id = session.subscription;

  // Determine plan from the subscription's price (available in expanded object)
  // If not expanded here, subscription.updated will handle plan update
  const priceId = session.line_items?.data?.[0]?.price?.id;
  if (priceId) {
    const plan = getPlanFromPriceId(priceId);
    if (plan !== 'free') updates.plan = plan;
  }

  updates.subscription_status = 'active';

  log.info({ tenantId, updates }, 'checkout.session.completed → updating tenant');
  await updateTenantSubscription(tenantId, updates);
}

// ── customer.subscription.updated ─────────────────────────────────────────
// Plan change, renewal, status change
async function handleSubscriptionUpdated(subscription, log) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) {
    // Fall back to looking up by customer ID
    const tenant = await getTenantByStripeCustomer(subscription.customer);
    if (!tenant) {
      log.warn({ customer: subscription.customer }, 'subscription.updated: tenant not found');
      return;
    }
    return _applySubscriptionUpdate(tenant.id, subscription, log);
  }
  return _applySubscriptionUpdate(tenantId, subscription, log);
}

async function _applySubscriptionUpdate(tenantId, subscription, log) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plan = priceId ? getPlanFromPriceId(priceId) : undefined;

  const updates = {
    subscription_status: subscription.status,
    subscription_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    stripe_subscription_id: subscription.id,
  };
  if (plan) updates.plan = plan;

  log.info({ tenantId, updates }, 'subscription.updated → updating tenant');
  await updateTenantSubscription(tenantId, updates);
}

// ── customer.subscription.deleted ─────────────────────────────────────────
// Subscription cancelled → downgrade to free
async function handleSubscriptionDeleted(subscription, log) {
  const tenantId = subscription.metadata?.tenant_id;
  let resolvedId = tenantId;

  if (!resolvedId) {
    const tenant = await getTenantByStripeCustomer(subscription.customer);
    if (!tenant) {
      log.warn({ customer: subscription.customer }, 'subscription.deleted: tenant not found');
      return;
    }
    resolvedId = tenant.id;
  }

  const updates = {
    plan: 'free',
    subscription_status: 'canceled',
    stripe_subscription_id: null,
    subscription_period_end: null,
  };

  log.info({ tenantId: resolvedId }, 'subscription.deleted → downgrading to free');
  await updateTenantSubscription(resolvedId, updates);
}

// ── invoice.payment_failed ─────────────────────────────────────────────────
// Payment failed → mark as past_due
async function handlePaymentFailed(invoice, log) {
  const tenantId = invoice.subscription_details?.metadata?.tenant_id;
  let resolvedId = tenantId;

  if (!resolvedId) {
    const tenant = await getTenantByStripeCustomer(invoice.customer);
    if (!tenant) {
      log.warn({ customer: invoice.customer }, 'payment_failed: tenant not found');
      return;
    }
    resolvedId = tenant.id;
  }

  log.info({ tenantId: resolvedId }, 'invoice.payment_failed → marking past_due');
  await updateTenantSubscription(resolvedId, { subscription_status: 'past_due' });
}
