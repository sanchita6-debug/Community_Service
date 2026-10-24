/**
 * VoicePay API server
 * ---------------------------------------------------------------------------
 * Express app that exposes the explain / safety / settings endpoints.
 * It NEVER touches a bank. The only things it can do are explain text,
 * warn about text, and store display preferences.
 */
import './env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { attachUser } from './auth.js';
import explainTransactionRouter from './routes/explainTransaction.js';
import checkSafetyRouter from './routes/checkSafety.js';
import settingsRouter from './routes/settings.js';
import progressRouter from './routes/progress.js';
import activityRouter from './routes/activity.js';
import { databasePath, databaseKind, storeStats, closeDatabase } from './store.js';
import { DEFAULT_USER_SETTINGS } from '../../shared/demoData.js';

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Storage: a SQLite database in server/data (see server/src/store.js and
// server/src/db.js). Every user's settings, progress, and feature activity are
// written to a file, so a save survives a restart. Nothing is sent to any
// third party and this process still never touches a bank.
// ---------------------------------------------------------------------------
console.log(
  databaseKind === 'memory'
    ? '[store] SQLite at :memory: (ephemeral).'
    : `[store] SQLite at ${databasePath}`
);

export const app = express();

app.use(
  helmet({
    // The client is a separate origin in dev; keep CSP permissive enough for
    // the blob workers used by Tesseract.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [CLIENT_ORIGIN, 'http://localhost:4173'],
    credentials: true,
  })
);
app.use(express.json({ limit: '256kb' }));
app.use(attachUser);

// A gentle global cap. This is a free demo service; it should not be abused.
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { ok: false, error: 'rate.limited', message: 'Please wait a moment and try again.' },
  })
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/api/health', async (_req, res) => {
  res.json({
    ok: true,
    service: 'voicepay-api',
    version: '1.0.0',
    store: databaseKind,
    stats: await storeStats(),
    // Always true. VoicePay never processes a payment.
    demoMode: true,
  });
});

app.get('/api/defaults', (_req, res) => {
  res.json({ ok: true, settings: DEFAULT_USER_SETTINGS });
});

app.use('/api/explain-transaction', explainTransactionRouter);
app.use('/api/check-safety', checkSafetyRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/activity', activityRouter);

// 404 for anything else under /api
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'not.found' });
});

// Central error handler so a thrown error never leaks a stack trace.
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({
    ok: false,
    error: 'server.error',
    message: 'Something went wrong. Please try again.',
  });
});

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log('');
    console.log('  VoicePay API running at http://localhost:%d', PORT);
    console.log('  Demo mode: no real payments are ever processed.');
    console.log('');
  });

  // Close the database on the way out so SQLite checkpoints its WAL file
  // instead of leaving it for the next start to recover.
  const shutdown = () => {
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
    // Do not hang forever if a keep-alive connection refuses to close.
    setTimeout(() => {
      closeDatabase();
      process.exit(0);
    }, 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
