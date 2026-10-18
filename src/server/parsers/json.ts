import type { ParsedReport, TestRun, TestResult } from '../../shared/types.ts';
import { classifyResult } from '../services/ingest.ts';

export function parseJsonReport(text: string): ParsedReport {
  const data = JSON.parse(text) as {
    run: { id: string; suite: string; branch: string; commit: string; startedAt: string; durationMs: number };
    results: Array<{ testId: string; name: string; status: string; durationMs: number; message?: string }>;
  };

  const run: TestRun = {
    id: data.run.id,
    suite: data.run.suite,
    branch: data.run.branch,
    commit: data.run.commit,
    startedAt: data.run.startedAt,
    durationMs: data.run.durationMs,
  };

  const results: TestResult[] = data.results.map((r) => {
    const result: TestResult = {
      runId: run.id,
      testId: r.testId,
      name: r.name,
      status: classifyResult(r.status),
      durationMs: r.durationMs,
    };
    if (r.message) result.message = r.message;
    return result;
  });

  return { run, results };
}
