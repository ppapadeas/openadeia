import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { buildApp } from './app.js';

// Init Sentry before anything else so it captures all errors.
// No-op when SENTRY_DSN is not configured.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    release: process.env.GITHUB_SHA,
    tracesSampleRate: 0.1,
  });
}

const app = await buildApp();

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Server listening on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
