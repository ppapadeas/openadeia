/**
 * In-memory async job store for long-running TEE operations.
 *
 * Jobs expire after TTL_MS (default 10 minutes) to prevent memory leaks.
 * Each job has: { id, status, result, error, createdAt, completedAt }
 */

import { randomUUID } from 'node:crypto';

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const jobs = new Map();

export function createJob() {
  const id = randomUUID();
  const job = {
    id,
    status: 'pending',   // pending | running | completed | failed
    result: null,
    error: null,
    createdAt: Date.now(),
    completedAt: null,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  // Expire stale jobs on read
  if (Date.now() - job.createdAt > TTL_MS) {
    jobs.delete(id);
    return null;
  }
  return job;
}

export function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, updates);
}

export function completeJob(id, result) {
  updateJob(id, { status: 'completed', result, completedAt: Date.now() });
}

export function failJob(id, error) {
  updateJob(id, { status: 'failed', error, completedAt: Date.now() });
}

// Periodic cleanup of expired jobs (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > TTL_MS) jobs.delete(id);
  }
}, 5 * 60 * 1000).unref();
