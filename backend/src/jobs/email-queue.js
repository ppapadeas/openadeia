/**
 * Email queue helper — adds email jobs to BullMQ for async delivery.
 * Keeps API responses fast; actual sending happens in the worker.
 */
import { Queue } from 'bullmq';
import redis from '../config/redis.js';
import { FROM_ADDRESS } from '../config/email.js';

const emailQueue = new Queue('email-notifications', { connection: redis });

/**
 * Queue a transactional email (verification, password reset, etc.)
 * These do NOT go through the `emails` DB table (that's for project comms).
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text]
 */
export async function queueEmail({ to, subject, html, text }) {
  await emailQueue.add('send', { to, subject, html, text: text || html.replace(/<[^>]+>/g, '') }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}

export { emailQueue, FROM_ADDRESS };
