import type { Request, Response } from 'express';
import { listRuns } from '../db/repos/runsRepo.ts';
import { findResultsSince } from '../db/repos/resultsRepo.ts';
import { countOpenDefects } from '../db/repos/defectsRepo.ts';
import { calculatePassRate, detectFlakyTests, buildTrend } from '../services/metrics.ts';
import { findResultsByRun } from '../db/repos/resultsRepo.ts';

export async function getDashboardSummary(req: Request, res: Response): Promise<void> {
  const db = req.app.locals['db'];

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const allRuns = listRuns(db, 1000);
  const recentResults = findResultsSince(db, sinceIso);
  const openDefects = countOpenDefects(db);

  const passRate = calculatePassRate(recentResults);
  const flaky = detectFlakyTests(recentResults);
  const trend = buildTrend(recentResults, allRuns);

  const recentRuns = allRuns.slice(0, 10).map((run) => ({
    ...run,
    passRate: calculatePassRate(findResultsByRun(db, run.id)),
  }));

  res.json({
    passRate,
    totalRuns: allRuns.length,
    flakyCount: flaky.length,
    openDefects,
    trend,
    flaky,
    recentRuns,
  });
}
