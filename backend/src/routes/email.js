import db from '../config/database.js';
import { sendEmailSchema, zodValidator } from '../middleware/validate.js';
import { Queue } from 'bullmq';
import redis from '../config/redis.js';

const emailQueue = new Queue('email', { connection: redis });

export default async function emailRoute(fastify) {
  // GET /api/projects/:id/emails
  fastify.get('/:id/emails', async (req, reply) => {
    const emails = await db('emails')
      .where({ project_id: req.params.id })
      .orderBy('sent_at', 'desc');
    reply.send(emails);
  });

  // POST /api/projects/:id/email
  fastify.post('/:id/email', { preHandler: zodValidator(sendEmailSchema) }, async (req, reply) => {
    const { to, subject, body, attachmentDocIds = [] } = req.body;
    const project = await db('projects').where({ id: req.params.id }).first();
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    const attachments = [];
    if (attachmentDocIds.length) {
      const docs = await db('documents').whereIn('id', attachmentDocIds);
      attachments.push(...docs.map(d => ({ name: d.label || d.doc_type, minio_path: d.file_path, size: d.file_size })));
    }

    const [email] = await db('emails').insert({
      project_id: req.params.id,
      direction: 'sent',
      from_address: process.env.SMTP_FROM || 'noreply@eadeies.local',
      to_address: to,
      subject,
      body,
      attachments: JSON.stringify(attachments),
    }).returning('*');

    // Enqueue async sending
    await emailQueue.add('send', { emailId: email.id, to, subject, body, attachments, projectCode: project.code });

    await db('workflow_logs').insert({
      project_id: req.params.id,
      action: `Email προς ${to}: "${subject}"`,
      metadata: { email_id: email.id },
    });

    reply.code(201).send(email);
  });
}
