import { DatabaseSync } from 'node:sqlite';
import type { TestResult } from '../../../shared/types.ts';

function rowToResult(r: Record<string, unknown>): TestResult {
  const result: TestResult = {
    runId: r['run_id'] as string,
    testId: r['test_id'] as string,
    name: r['name'] as string,
    status: r['status'] as TestResult['status'],
    durationMs: r['duration_ms'] as number,
  };
  if (r['message'] != null) result.message = r['message'] as string;
  return result;
}

export function insertResults(db: DatabaseSync, results: TestResult[]): void {
  const stmt = db.prepare(
    `INSERT INTO test_results (run_id, test_id, name, status, duration_ms, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of results) {
    stmt.run(r.runId, r.testId, r.name, r.status, r.durationMs, r.message ?? null);
  }
}

export function findResultsByRun(db: DatabaseSync, runId: string): TestResult[] {
  const rows = db.prepare(`SELECT * FROM test_results WHERE run_id = ?`).all(runId) as Record<string, unknown>[];
  return rows.map(rowToResult);
}

export function findResultsSince(db: DatabaseSync, since: string): TestResult[] {
  const rows = db.prepare(`
    SELECT tr.*
    FROM test_results tr
    JOIN test_runs ru ON ru.id = tr.run_id
    WHERE ru.started_at >= ?
    ORDER BY ru.started_at ASC
  `).all(since) as Record<string, unknown>[];
  return rows.map(rowToResult);
}
