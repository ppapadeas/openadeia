/**
 * error-monitor.js — Fastify plugin
 *
 * Catches all unhandled errors with statusCode >= 500 and sends a
 * Telegram notification to Mitsaras via the openclaw CLI.
 *
 * Features:
 * - Fire-and-forget (never blocks the response)
 * - Deduplication: same error not sent more than once per 5 minutes
 */

import fp from 'fastify-plugin';
import { exec } from 'child_process';
import { LimitExceededError } from '../errors/LimitExceededError.js';

const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const seenErrors = new Map(); // key → timestamp

function isDuplicate(key) {
  const last = seenErrors.get(key);
  if (!last) return false;
  if (Date.now() - last < DEDUP_TTL_MS) return true;
  seenErrors.delete(key);
  return false;
}

function markSeen(key) {
  seenErrors.set(key, Date.now());
}

function buildMessage(err, request) {
  const method = request?.method || 'UNKNOWN';
  const url = request?.url || 'UNKNOWN';
  const ts = new Date().toISOString();

  const stackLines = (err.stack || '')
    .split('\n')
    .slice(0, 3)
    .map(l => l.trim())
    .join(' | ');

  return `🚨 OpenAdeia Error\n` +
    `Time: ${ts}\n` +
    `Route: ${method} ${url}\n` +
    `Error: ${err.message}\n` +
    `Stack: ${stackLines}`;
}

async function errorMonitorPlugin(app) {
  app.setErrorHandler((err, request, reply) => {
    // ── 402 Plan limit exceeded ──────────────────────────────────────
    if (err instanceof LimitExceededError) {
      return reply.code(402).send({
        error: err.message,
        limitType: err.limitType,
        current: err.current,
        max: err.max,
        upgradeRequired: true,
        statusCode: 402,
      });
    }

    const statusCode = err.statusCode || 500;

    if (statusCode >= 500) {
      const dedupKey = `${err.message}::${request?.url}`;

      if (!isDuplicate(dedupKey)) {
        markSeen(dedupKey);

        const msg = buildMessage(err, request);
        // Escape double quotes for shell safety
        const safeMsg = msg.replace(/"/g, '\\"').replace(/\n/g, '\\n');

        exec(
          `openclaw message send --channel telegram --target 7677256363 --message "${safeMsg}"`,
          (execErr) => {
            if (execErr) {
              app.log.warn({ execErr }, 'error-monitor: failed to send Telegram notification');
            }
          }
        );
      }
    }

    // Let Fastify's default error handler send the response
    reply.code(statusCode).send({
      error: err.message || 'Internal Server Error',
      statusCode,
    });
  });
}

export default fp(errorMonitorPlugin, {
  name: 'error-monitor',
  fastify: '4.x || 5.x',
});
