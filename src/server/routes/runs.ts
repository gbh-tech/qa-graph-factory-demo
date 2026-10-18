import type { Request, Response } from 'express';
import type { ReportFormat } from '../../shared/types.ts';
import { InvalidReportError, DuplicateRunError, ReportTooLargeError } from '../errors.ts';
import { ingestReport } from '../services/ingest.ts';
import { findRun, listRuns } from '../db/repos/runsRepo.ts';
import { findResultsByRun } from '../db/repos/resultsRepo.ts';
import { calculatePassRate } from '../services/metrics.ts';
import { exportRunCsv } from '../services/export.ts';

function sendError(res: Response, err: unknown): void {
  if (err instanceof ReportTooLargeError) {
    res.status(413).json({ error: err.name, message: err.message });
    return;
  }
  if (err instanceof DuplicateRunError) {
    res.status(409).json({ error: err.name, message: err.message });
    return;
  }
  if (err instanceof InvalidReportError) {
    res.status(400).json({ error: err.name, message: err.message });
    return;
  }
  throw err;
}

export async function createRunHandler(req: Request, res: Response): Promise<void> {
  const format = req.query['format'] as ReportFormat;
  const db = req.app.locals['db'];
  try {
    const result = ingestReport(db, req.body as string, format);
    res.status(201).json(result);
  } catch (err) {
    sendError(res, err);
  }
}

export async function listRunsHandler(req: Request, res: Response): Promise<void> {
  const db = req.app.locals['db'];
  const limit = Number(req.query['limit'] ?? 20);
  const runs = listRuns(db, limit);
  const result = runs.map((run) => ({
    ...run,
    passRate: calculatePassRate(findResultsByRun(db, run.id)),
  }));
  res.json(result);
}

export async function getRunHandler(req: Request, res: Response): Promise<void> {
  const db = req.app.locals['db'];
  const run = findRun(db, req.params['id'] as string);
  if (!run) {
    res.status(404).json({ error: 'NotFound', message: 'Run not found' });
    return;
  }
  const results = findResultsByRun(db, run.id);
  res.json({ run, results });
}

export async function exportRunHandler(req: Request, res: Response): Promise<void> {
  const db = req.app.locals['db'];
  const run = findRun(db, req.params['id'] as string);
  if (!run) {
    res.status(404).json({ error: 'NotFound', message: 'Run not found' });
    return;
  }
  const results = findResultsByRun(db, run.id);
  const csv = exportRunCsv(run, results);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="run-${run.id}.csv"`);
  res.send(csv);
}
