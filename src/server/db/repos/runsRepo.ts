import { DatabaseSync } from 'node:sqlite';
import type { TestRun } from '../../../shared/types.ts';

function rowToRun(r: Record<string, unknown>): TestRun {
  return {
    id: r['id'] as string,
    suite: r['suite'] as string,
    branch: r['branch'] as string,
    commit: r['commit_sha'] as string,
    startedAt: r['started_at'] as string,
    durationMs: r['duration_ms'] as number,
  };
}

export function insertRun(db: DatabaseSync, run: TestRun): void {
  db.prepare(
    `INSERT INTO test_runs (id, suite, branch, commit_sha, started_at, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(run.id, run.suite, run.branch, run.commit, run.startedAt, run.durationMs);
}

export function findRun(db: DatabaseSync, id: string): TestRun | undefined {
  const row = db.prepare(`SELECT * FROM test_runs WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? rowToRun(row) : undefined;
}

export function listRuns(db: DatabaseSync, limit = 20): TestRun[] {
  const rows = db.prepare(`SELECT * FROM test_runs ORDER BY started_at DESC LIMIT ?`).all(limit) as Record<string, unknown>[];
  return rows.map(rowToRun);
}

export function runExists(db: DatabaseSync, id: string): boolean {
  const row = db.prepare(`SELECT 1 FROM test_runs WHERE id = ?`).get(id);
  return row != null;
}
