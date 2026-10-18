import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { MAX_REPORT_BYTES } from './config.ts';
import { createRunHandler, listRunsHandler, getRunHandler, exportRunHandler } from './routes/runs.ts';
import { getDashboardSummary } from './routes/dashboard.ts';

export function createApp(db: DatabaseSync) {
  const app = express();
  app.locals['db'] = db;

  app.post(
    '/api/runs',
    express.text({ type: '*/*', limit: MAX_REPORT_BYTES * 2 }),
    createRunHandler
  );
  app.get('/api/runs', listRunsHandler);
  app.get('/api/runs/:id/export', exportRunHandler);
  app.get('/api/runs/:id', getRunHandler);
  app.get('/api/dashboard', getDashboardSummary);

  return app;
}
