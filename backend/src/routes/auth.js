import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import db from '../config/database.js';
import {
  registerSchema,
  loginSchema,
  profileUpdateSchema,
  signupOrgSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  zodValidator,
} from '../middleware/validate.js';
import { queueEmail } from '../jobs/email-queue.js';

// ── Helpers ────────────────────────────────────────────────────────

/** Convert org name to URL-safe slug */
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63);
}

/** Ensure slug is unique by appending a counter */
async function uniqueSlug(base) {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await db('tenants').where({ slug }).first();
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

/** Generate a secure random token (hex) */
function generateToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

// ── TEE password encryption (AES-256-CTR, reversible) ──────────────
function getTeeKey() {
  return createHash('sha256').update(process.env.JWT_SECRET || 'dev-secret').digest();
}

export function encryptTeePassword(plaintext) {
  const key = getTeeKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-ctr', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

export function decryptTeePassword(ciphertext) {
  try {
    const [ivHex, encHex] = ciphertext.split(':');
    const key = getTeeKey();
    const iv = Buffer.from(ivHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = createDecipheriv('aes-256-ctr', key, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ── Email templates ────────────────────────────────────────────────

function buildVerificationEmail(name, token) {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${base}/verify-email?token=${token}`;
  return {
    subject: 'Επαλήθευση email — OpenAdeia',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Καλωσήρθατε στο OpenAdeia, ${name}!</h2>
        <p>Παρακαλούμε επαληθεύστε το email σας κάνοντας κλικ στον παρακάτω σύνδεσμο:</p>
        <p>
          <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
            Επαλήθευση Email
          </a>
        </p>
        <p style="color:#888;font-size:12px;">Ο σύνδεσμος λήγει σε 48 ώρες. Αν δεν δημιουργήσατε λογαριασμό, αγνοήστε αυτό το email.</p>
      </div>
    `,
  };
}

function buildPasswordResetEmail(name, token) {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${base}/reset-password/${token}`;
  return {
    subject: 'Επαναφορά κωδικού — OpenAdeia',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Επαναφορά κωδικού πρόσβασης</h2>
        <p>Γεια σου ${name}, λάβαμε αίτημα επαναφοράς κωδικού για τον λογαριασμό σου.</p>
        <p>
          <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">
            Επαναφορά Κωδικού
          </a>
        </p>
        <p style="color:#888;font-size:12px;">Ο σύνδεσμος λήγει σε 1 ώρα. Αν δεν ζητήσατε επαναφορά, αγνοήστε αυτό το email.</p>
      </div>
    `,
  };
}

// ── Route plugin ───────────────────────────────────────────────────

export default async function authRoute(fastify) {

  // ── POST /api/auth/signup-org ─────────────────────────────────────
  // Multi-tenant org signup: creates tenant + admin user
  fastify.post('/signup-org', { preHandler: zodValidator(signupOrgSchema) }, async (req, reply) => {
    const { email, name, password, orgName } = req.body;

    // Check email uniqueness
    const existing = await db('users').where({ email }).first();
    if (existing) {
      return reply.code(409).send({ error: 'Υπάρχει ήδη λογαριασμός με αυτό το email' });
    }

    const slug = await uniqueSlug(slugify(orgName));
    const password_hash = await bcrypt.hash(password, 12);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // +14 days

    // Create tenant
    const [tenant] = await db('tenants').insert({
      slug,
      name: orgName,
      plan: 'free',
      status: 'trialing',
      trial_ends_at: trialEndsAt,
      settings: JSON.stringify({}),
      limits: JSON.stringify({ projects_max: 5, storage_max_bytes: 524288000, team_max: 1 }),
      usage: JSON.stringify({ projects_count: 0, storage_bytes: 0, team_count: 0 }),
    }).returning(['id', 'slug', 'name', 'plan', 'status', 'trial_ends_at']);

    // Create email verify token
    const email_verify_token = generateToken(32);

    // Create admin user
    const [user] = await db('users').insert({
      tenant_id: tenant.id,
      email,
      name,
      password_hash,
      role: 'admin',
      email_verify_token,
    }).returning(['id', 'email', 'name', 'role', 'tenant_id', 'created_at']);

    // Seed demo data (non-blocking)
    try {
      const { seedDemoTenant } = await import('../services/demo-seeder.js');
      await seedDemoTenant(tenant.id);
    } catch (err) {
      fastify.log.warn({ err }, 'Demo seeding failed (non-fatal)');
    }

    // Queue verification email (non-blocking)
    try {
      const { subject, html } = buildVerificationEmail(name, email_verify_token);
      await queueEmail({ to: email, subject, html });
    } catch (err) {
      fastify.log.warn({ err }, 'Verification email queue failed (non-fatal)');
    }

    const token = fastify.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant_id: tenant.id,
        plan: tenant.plan,
        is_superadmin: false,
      },
      { expiresIn: '7d' }
    );

    reply.code(201).send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: tenant.id,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
        trial_ends_at: tenant.trial_ends_at,
      },
    });
  });

  // ── POST /api/auth/forgot-password ────────────────────────────────
  fastify.post('/forgot-password', { preHandler: zodValidator(forgotPasswordSchema) }, async (req, reply) => {
    const { email } = req.body;

    // Always return 200 to prevent email enumeration
    const user = await db('users').where({ email }).first();
    if (!user) {
      return reply.send({ message: 'Αν το email υπάρχει στο σύστημα, θα λάβετε οδηγίες επαναφοράς.' });
    }

    const token = generateToken(32);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db('users').where({ id: user.id }).update({
      password_reset_token: token,
      password_reset_expires: expires,
    });

    try {
      const { subject, html } = buildPasswordResetEmail(user.name, token);
      await queueEmail({ to: email, subject, html });
    } catch (err) {
      fastify.log.warn({ err }, 'Password reset email queue failed');
    }

    reply.send({ message: 'Αν το email υπάρχει στο σύστημα, θα λάβετε οδηγίες επαναφοράς.' });
  });

  // ── POST /api/auth/reset-password ────────────────────────────────
  fastify.post('/reset-password', { preHandler: zodValidator(resetPasswordSchema) }, async (req, reply) => {
    const { token, password } = req.body;

    const user = await db('users')
      .where({ password_reset_token: token })
      .where('password_reset_expires', '>', new Date())
      .first();

    if (!user) {
      return reply.code(400).send({ error: 'Μη έγκυρος ή ληγμένος σύνδεσμος επαναφοράς κωδικού.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    await db('users').where({ id: user.id }).update({
      password_hash,
      password_reset_token: null,
      password_reset_expires: null,
    });

    reply.send({ message: 'Ο κωδικός ενημερώθηκε επιτυχώς.' });
  });

  // ── POST /api/auth/verify-email ───────────────────────────────────
  fastify.post('/verify-email', { preHandler: zodValidator(verifyEmailSchema) }, async (req, reply) => {
    const { token } = req.body;

    const user = await db('users').where({ email_verify_token: token }).first();

    if (!user) {
      return reply.code(400).send({ error: 'Μη έγκυρος σύνδεσμος επαλήθευσης.' });
    }

    await db('users').where({ id: user.id }).update({
      email_verified_at: new Date(),
      email_verify_token: null,
    });

    reply.send({ message: 'Το email επαληθεύτηκε επιτυχώς.' });
  });

  // ── POST /api/auth/register (single-user, legacy) ─────────────────
  fastify.post('/register', { preHandler: zodValidator(registerSchema) }, async (req, reply) => {
    const { email, name, password, amh } = req.body;

    const existing = await db('users').where({ email }).first();
    if (existing) {
      return reply.code(409).send({ error: 'Υπάρχει ήδη λογαριασμός με αυτό το email' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const [user] = await db('users').insert({
      email,
      name,
      password_hash,
      amh: amh || null,
      role: 'engineer',
    }).returning(['id', 'email', 'name', 'role', 'amh', 'created_at']);

    const token = fastify.jwt.sign(
      { id: user.id, email: user.email, role: user.role, is_superadmin: user.is_superadmin ?? false },
      { expiresIn: '7d' }
    );
    reply.code(201).send({ token, user });
  });

  // ── POST /api/auth/login ───────────────────────────────────────────
  fastify.post('/login', { preHandler: zodValidator(loginSchema) }, async (req, reply) => {
    const { email, password } = req.body;

    const user = await db('users').where({ email }).first();
    if (!user || !user.password_hash) {
      return reply.code(401).send({ error: 'Λάθος email ή κωδικός' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Λάθος email ή κωδικός' });
    }

    // Load tenant info if user has tenant_id
    let tenantInfo = null;
    if (user.tenant_id) {
      tenantInfo = await db('tenants').where({ id: user.tenant_id })
        .select('id', 'slug', 'name', 'plan', 'status', 'trial_ends_at')
        .first();
    }

    const token = fastify.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id || null,
        plan: tenantInfo?.plan || null,
        is_superadmin: user.is_superadmin ?? false,
      },
      { expiresIn: '7d' }
    );

    reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        amh: user.amh,
        tenant_id: user.tenant_id || null,
        is_superadmin: user.is_superadmin ?? false,
      },
      tenant: tenantInfo,
    });
  });

  // ── GET /api/auth/me ───────────────────────────────────────────────
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'email', 'name', 'role', 'amh', 'tee_username', 'created_at', 'is_superadmin', 'tenant_id', 'email_verified_at')
      .first();
    if (!user) return reply.code(404).send({ error: 'User not found' });

    let tenant = null;
    if (user.tenant_id) {
      tenant = await db('tenants').where({ id: user.tenant_id })
        .select('id', 'slug', 'name', 'plan', 'status', 'trial_ends_at')
        .first();
    }

    reply.send({ ...user, tenant });
  });

  // ── PATCH /api/auth/profile ────────────────────────────────────────
  fastify.patch('/profile', { onRequest: [fastify.authenticate], preHandler: zodValidator(profileUpdateSchema) }, async (req, reply) => {
    const { name, amh, tee_username, tee_password, current_password, new_password } = req.body;

    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (amh !== undefined) updates.amh = amh;
    if (tee_username !== undefined) updates.tee_username = tee_username;
    if (tee_password !== undefined) {
      updates.tee_password_enc = tee_password ? encryptTeePassword(tee_password) : null;
    }

    // Change app password
    if (new_password) {
      if (!current_password) return reply.code(400).send({ error: 'Απαιτείται ο τρέχων κωδικός' });
      if (!user.password_hash) return reply.code(400).send({ error: 'Δεν υπάρχει κωδικός για αλλαγή' });
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return reply.code(401).send({ error: 'Λάθος τρέχων κωδικός' });
      updates.password_hash = await bcrypt.hash(new_password, 12);
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'Δεν δόθηκαν στοιχεία για ενημέρωση' });
    }

    const [updated] = await db('users').where({ id: req.user.id })
      .update(updates)
      .returning(['id', 'email', 'name', 'role', 'amh', 'tee_username', 'created_at']);

    reply.send(updated);
  });
}
