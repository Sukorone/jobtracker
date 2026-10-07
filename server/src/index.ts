import { serve } from '@hono/node-server';
import { join } from 'node:path';
import { createApp } from './app.ts';
import { purgeExpiredSessions } from './auth.ts';
import { openDb } from './db.ts';

const port = Number(process.env.PORT ?? 8787);
const dataDir = process.env.DATA_DIR ?? join(import.meta.dirname, '..', 'data');
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const db = openDb(join(dataDir, 'jobtracker.db'));
const staticDir = process.env.STATIC_DIR || undefined;
const app = createApp({ db, corsOrigins, trustProxy: process.env.TRUST_PROXY === '1', staticDir });

purgeExpiredSessions(db);
setInterval(() => purgeExpiredSessions(db), 6 * 60 * 60 * 1000).unref();

const server = serve({ fetch: app.fetch, port, hostname: process.env.HOST ?? '0.0.0.0' }, (info) => {
  console.log(`jobtracker api on :${info.port}, data in ${dataDir}, CORS: ${corsOrigins.join(', ') || 'none'}`);
  if (staticDir) console.log(`serving frontend from ${staticDir} at /jobtracker/`);
});

const shutdown = () => {
  server.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
