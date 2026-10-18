import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../../src/server/db/connection.ts';
import { applySchema } from '../../src/server/db/schema.ts';
import { createApp } from '../../src/server/app.ts';
import { insertRun } from '../../src/server/db/repos/runsRepo.ts';
import { insertResults } from '../../src/server/db/repos/resultsRepo.ts';
import { insertDefect } from '../../src/server/db/repos/defectsRepo.ts';
import type { TestRun, TestResult, Defect } from '../../src/shared/types.ts';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function makeRun(id: string, daysBack: number): TestRun {
  return {
    id,
    suite: 'api',
    branch: 'main',
    commit: 'abc123',
    startedAt: daysAgo(daysBack),
    durationMs: 2000,
  };
}

function makeResult(runId: string, testId: string, status: TestResult['status']): TestResult {
  return { runId, testId, name: testId, status, durationMs: 10 };
}

/**
 * Seed schema:
 *
 * run-dash-1 (10 days ago): 4 passed, 1 failed
 * run-dash-2 (3 days ago):  4 passed, 1 failed
 *
 * Total relevant results (last 30 days): 8 passed, 2 failed → passRate = 0.8
 * All testIds are unique per run → flakyCount = 0
 * Defects: 3 open, 1 closed → openDefects = 3
 */
function seedDb(db: DatabaseSync): void {
  const run1 = makeRun('run-dash-1', 10);
  const run2 = makeRun('run-dash-2', 3);
  insertRun(db, run1);
  insertRun(db, run2);

  const results1: TestResult[] = [
    makeResult('run-dash-1', 'suite::file::test-a1', 'passed'),
    makeResult('run-dash-1', 'suite::file::test-a2', 'passed'),
    makeResult('run-dash-1', 'suite::file::test-a3', 'passed'),
    makeResult('run-dash-1', 'suite::file::test-a4', 'passed'),
    makeResult('run-dash-1', 'suite::file::test-a5', 'failed'),
  ];
  const results2: TestResult[] = [
    makeResult('run-dash-2', 'suite::file::test-b1', 'passed'),
    makeResult('run-dash-2', 'suite::file::test-b2', 'passed'),
    makeResult('run-dash-2', 'suite::file::test-b3', 'passed'),
    makeResult('run-dash-2', 'suite::file::test-b4', 'passed'),
    makeResult('run-dash-2', 'suite::file::test-b5', 'failed'),
  ];
  insertResults(db, results1);
  insertResults(db, results2);

  const defects: Defect[] = [
    { id: 'BUG-001', testId: 'suite::file::test-a5', title: 'Login broken', severity: 'high', open: true },
    { id: 'BUG-002', testId: 'suite::file::test-b5', title: 'Logout timeout', severity: 'medium', open: true },
    { id: 'BUG-003', testId: 'suite::file::test-a1', title: 'Flaky render', severity: 'low', open: true },
    { id: 'BUG-004', testId: 'suite::file::test-a2', title: 'Old bug', severity: 'low', open: false },
  ];
  for (const d of defects) {
    insertDefect(db, d);
  }
}

describe('REQ-007 dashboard API', () => {
  let app: ReturnType<typeof createApp>;
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb(':memory:');
    applySchema(db);
    seedDb(db);
    app = createApp(db);
  });

  it('GET /api/dashboard returns 200', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
  });

  it('passRate is 0.8 (8 passed / 10 relevant in last 30 days)', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.body.passRate).toBeCloseTo(0.8);
  });

  it('totalRuns equals the number of seeded runs', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.body.totalRuns).toBe(2);
  });

  it('flakyCount is 0 (no testId appears in multiple runs)', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.body.flakyCount).toBe(0);
  });

  it('openDefects is 3 (three open defects seeded)', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.body.openDefects).toBe(3);
  });

  it('trend array has 30 entries', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(Array.isArray(res.body.trend)).toBe(true);
    expect(res.body.trend).toHaveLength(30);
  });

  it('trend entries have date, passRate, and runs fields', async () => {
    const res = await request(app).get('/api/dashboard');
    const entry = res.body.trend[0];
    expect(entry).toHaveProperty('date');
    expect(entry).toHaveProperty('passRate');
    expect(entry).toHaveProperty('runs');
  });

  it('recentRuns includes run entries with passRate', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(Array.isArray(res.body.recentRuns)).toBe(true);
    expect(res.body.recentRuns.length).toBeGreaterThan(0);
    expect(typeof res.body.recentRuns[0].passRate).toBe('number');
  });

  it('flaky array is present and is an array', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(Array.isArray(res.body.flaky)).toBe(true);
  });
});
