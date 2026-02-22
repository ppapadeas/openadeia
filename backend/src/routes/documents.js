import crypto from 'crypto';
import db from '../config/database.js';
import minioClient, { BUCKET, buildPath } from '../config/minio.js';
import { updateDocumentSchema, zodValidator } from '../middleware/validate.js';

export default async function documentsRoute(fastify) {
  // GET /api/projects/:id/documents
  fastify.get('/:id/documents', async (req, reply) => {
    const docs = await db('documents')
      .where({ project_id: req.params.id })
      .orderBy('uploaded_at', 'desc');
    reply.send(docs);
  });

  // POST /api/projects/:id/documents (multipart upload → MinIO)
  fastify.post('/:id/documents', async (req, reply) => {
    const parts = req.parts();
    let docType, label, notes;
    let fileBuffer, fileName, mimeType;
    const hash = crypto.createHash('sha256');

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'doc_type') docType = part.value;
        if (part.fieldname === 'label') label = part.value;
        if (part.fieldname === 'notes') notes = part.value;
      } else if (part.type === 'file') {
        fileName = part.filename;
        mimeType = part.mimetype;
        const chunks = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
          hash.update(chunk);
        }
        fileBuffer = Buffer.concat(chunks);
      }
    }

    if (!fileBuffer || !docType) {
      return reply.code(400).send({ error: 'Missing file or doc_type' });
    }

    const fileHash = hash.digest('hex');
    const category = ['arch', 'static', 'mech', 'energy', 'passive_fire', 'active_fire', 'env', 'acoustic', 'geo', 'arch_cat1'].includes(docType)
      ? 'studies' : 'documents';
    const ext = fileName.split('.').pop();
    const safeName = `${docType}-${Date.now()}.${ext}`;
    const filePath = buildPath(req.params.id, category, safeName);

    await minioClient.putObject(BUCKET, filePath, fileBuffer, fileBuffer.length, {
      'Content-Type': mimeType,
      'x-amz-meta-project': req.params.id,
      'x-amz-meta-doc-type': docType,
    });

    // Upsert document record (one record per doc_type per project)
    const existing = await db('documents')
      .where({ project_id: req.params.id, doc_type: docType })
      .first();

    let doc;
    if (existing) {
      [doc] = await db('documents').where({ id: existing.id }).update({
        label, notes, status: 'uploaded',
        file_path: filePath, file_size: fileBuffer.length,
        file_hash: fileHash, mime_type: mimeType,
        uploaded_at: db.fn.now(),
      }).returning('*');
    } else {
      [doc] = await db('documents').insert({
        project_id: req.params.id,
        doc_type: docType, label, notes,
        status: 'uploaded',
        file_path: filePath, file_size: fileBuffer.length,
        file_hash: fileHash, mime_type: mimeType,
      }).returning('*');
    }

    await db('projects').where({ id: req.params.id }).update({ updated_at: db.fn.now() });
    reply.code(201).send(doc);
  });

  // PATCH /api/projects/:id/documents/:did
  fastify.patch('/:id/documents/:did', { preHandler: zodValidator(updateDocumentSchema) }, async (req, reply) => {
    const update = { ...req.body };
    if (update.status === 'signed') update.signed_at = new Date();

    const [doc] = await db('documents')
      .where({ id: req.params.did, project_id: req.params.id })
      .update(update)
      .returning('*');
    if (!doc) return reply.code(404).send({ error: 'Not found' });
    reply.send(doc);
  });

  // DELETE /api/projects/:id/documents/:did
  fastify.delete('/:id/documents/:did', async (req, reply) => {
    const doc = await db('documents').where({ id: req.params.did, project_id: req.params.id }).first();
    if (!doc) return reply.code(404).send({ error: 'Not found' });

    if (doc.file_path) {
      try { await minioClient.removeObject(BUCKET, doc.file_path); } catch (_) {}
    }

    await db('documents').where({ id: req.params.did }).del();
    reply.send({ success: true });
  });

  // GET /api/projects/:id/documents/:did/download — presigned URL
  fastify.get('/:id/documents/:did/download', async (req, reply) => {
    const doc = await db('documents').where({ id: req.params.did }).first();
    if (!doc?.file_path) return reply.code(404).send({ error: 'No file' });
    const url = await minioClient.presignedGetObject(BUCKET, doc.file_path, 3600);
    reply.send({ url });
  });
}
