import bcrypt from 'bcryptjs';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import db from '../config/database.js';
import { registerSchema, loginSchema, profileUpdateSchema, zodValidator } from '../middleware/validate.js';

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

export default async function authRoute(fastify) {
  // ── POST /api/auth/register ────────────────────────────────────────
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

    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role }, { expiresIn: '7d' });
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

    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role }, { expiresIn: '7d' });
    reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, amh: user.amh } });
  });

  // ── GET /api/auth/me ───────────────────────────────────────────────
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'email', 'name', 'role', 'amh', 'tee_username', 'created_at')
      .first();
    if (!user) return reply.code(404).send({ error: 'User not found' });
    reply.send(user);
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
