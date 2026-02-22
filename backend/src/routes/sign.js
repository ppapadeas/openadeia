import db from '../config/database.js';

// Stub for EU DSS digital signature integration
// Phase 2: integrate with eu-dss library or remote DSS server

export default async function signRoute(fastify) {
  // POST /api/sign/request
  fastify.post('/request', async (req, reply) => {
    const { documentId, signerRole } = req.body;
    const doc = await db('documents').where({ id: documentId }).first();
    if (!doc) return reply.code(404).send({ error: 'Document not found' });

    // TODO Phase 2: submit to EU DSS for signing
    // For now, generate a stub reference
    const signatureRef = `SIG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const [updated] = await db('documents').where({ id: documentId }).update({
      status: 'signed',
      signer_role: signerRole,
      signature_ref: signatureRef,
      signed_at: new Date(),
    }).returning('*');

    reply.send({ ref: signatureRef, document: updated });
  });

  // GET /api/sign/status/:ref
  fastify.get('/status/:ref', async (req, reply) => {
    const doc = await db('documents').where({ signature_ref: req.params.ref }).first();
    if (!doc) return reply.code(404).send({ error: 'Signature not found' });
    reply.send({ ref: req.params.ref, status: doc.status, signed_at: doc.signed_at });
  });
}
