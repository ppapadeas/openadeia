/**
 * Worker: email-notifications queue
 * Processes transactional emails (verification, password reset, etc.)
 * kept separate from the project email queue in jobs/email-sender.js.
 */
import { Worker } from 'bullmq';
import redis from '../config/redis.js';
import { transporter, FROM_ADDRESS } from '../config/email.js';

const worker = new Worker('email-notifications', async (job) => {
  const { to, subject, html, text } = job.data;

  await transporter.sendMail({
    from: `"OpenAdeia" <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
    text,
  });

  return { sent: true, to };
}, { connection: redis });

worker.on('failed', (job, err) => {
  console.error(`[email-notifications] Job ${job?.id} failed:`, err.message);
});

worker.on('completed', (job) => {
  console.log(`[email-notifications] Job ${job?.id} sent to: ${job.data.to}`);
});

export default worker;
