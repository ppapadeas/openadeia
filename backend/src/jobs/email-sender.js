import { Worker } from 'bullmq';
import redis from '../config/redis.js';
import { transporter, FROM_ADDRESS } from '../config/email.js';
import db from '../config/database.js';

const worker = new Worker('email', async (job) => {
  const { emailId, to, subject, body, projectCode } = job.data;

  await transporter.sendMail({
    from: `"e-Άδειες Manager [${projectCode}]" <${FROM_ADDRESS}>`,
    to,
    subject: `[${projectCode}] ${subject}`,
    html: body.replace(/\n/g, '<br>'),
    text: body,
  });

  await db('emails').where({ id: emailId }).update({ sent_at: new Date() });
  return { sent: true };
}, { connection: redis });

worker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err.message);
});

export default worker;
