import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../../src/server/db/connection.ts';
import { applySchema } from '../../src/server/db/schema.ts';
import { classifyResult, validateReport, ingestReport } from '../../src/server/services/ingest.ts';
import { InvalidReportError, DuplicateRunError } from '../../src/server/errors.ts';
import type { ParsedReport } from '../../src/shared/types.ts';

function freshDb(): DatabaseSync {
  const db = openDb(':memory:');
  applySchema(db);
  return db;
}

function makeReport(overrides: Partial<ParsedReport> = {}): ParsedReport {
  return {
    run: {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      suite: 'unit',
      branch: 'main',
      commit: 'abc123',
      startedAt: new Date().toISOString(),
      durationMs: 1000,
    },
    results: [
      { runId: 'placeholder', testId: 'suite::file::test', name: 'test', status: 'passed', durationMs: 10 },
    ],
    ...overrides,
  };
}

const JUNIT_XML = `<?xml version="1.0"?>
<testsuite name="api" tests="2" time="1.5" timestamp="2026-10-01T10:00:00">
  <properties>
    <property name="run.id" value="run-junit-ingest-001"/>
    <property name="branch" value="main"/>
    <property name="commit" value="deadbeef"/>
  </properties>
  <testcase classname="api.auth" name="login" time="0.5"/>
  <testcase classname="api.auth" name="logout" time="0.3">
    <failure message="Expected 200">AssertionError: got 401</failure>
  </testcase>
</testsuite>`;

const JSON_REPORT = JSON.stringify({
  run: {
    id: 'run-json-ingest-001',
    suite: 'web',
    branch: 'main',
    commit: 'cafebabe',
    startedAt: '2026-10-01T11:00:00.000Z',
    durationMs: 3000,
  },
  results: [
    { testId: 'web::home::renders', name: 'renders', status: 'passed', durationMs: 50 },
    { testId: 'web::home::dark-mode', name: 'dark-mode', status: 'skipped', durationMs: 0 },
    { testId: 'web::cart::adds-item', name: 'adds-item', status: 'failed', durationMs: 120, message: 'timeout' },
  ],
});

// ──────────────────────────────────────────────
describe('REQ-005 classifyResult', () => {
  it('normalises "pass" → passed', () => expect(classifyResult('pass')).toBe('passed'));
  it('normalises "ok" → passed', () => expect(classifyResult('ok')).toBe('passed'));
  it('normalises "success" → passed', () => expect(classifyResult('success')).toBe('passed'));
  it('normalises "passed" → passed', () => expect(classifyResult('passed')).toBe('passed'));

  it('normalises "fail" → failed', () => expect(classifyResult('fail')).toBe('failed'));
  it('normalises "failure" → failed', () => expect(classifyResult('failure')).toBe('failed'));
  it('normalises "failed" → failed', () => expect(classifyResult('failed')).toBe('failed'));

  it('normalises "error" → error', () => expect(classifyResult('error')).toBe('error'));

  it('normalises "skip" → skipped', () => expect(classifyResult('skip')).toBe('skipped'));
  it('normalises "skipped" → skipped', () => expect(classifyResult('skipped')).toBe('skipped'));
  it('normalises "pending" → skipped', () => expect(classifyResult('pending')).toBe('skipped'));
  it('normalises "ignored" → skipped', () => expect(classifyResult('ignored')).toBe('skipped'));

  it('is case-insensitive', () => {
    expect(classifyResult('PASSED')).toBe('passed');
    expect(classifyResult('FAILED')).toBe('failed');
    expect(classifyResult('SKIPPED')).toBe('skipped');
  });

  it('maps unknown values to skipped', () => {
    expect(classifyResult('unknown-status')).toBe('skipped');
  });
});

// ──────────────────────────────────────────────
describe('REQ-003 validateReport', () => {
  it('accepts a valid report without throwing', () => {
    const db = freshDb();
    expect(() => validateReport(db, makeReport())).not.toThrow();
  });

  it('throws InvalidReportError when run.id is missing', () => {
    const db = freshDb();
    const report = makeReport();
    (report.run as { id: string }).id = '';
    expect(() => validateReport(db, report)).toThrow(InvalidReportError);
  });

  it('throws InvalidReportError when run.suite is missing', () => {
    const db = freshDb();
    const report = makeReport();
    (report.run as { suite: string }).suite = '';
    expect(() => validateReport(db, report)).toThrow(InvalidReportError);
  });

  it('throws InvalidReportError when results array is empty', () => {
    const db = freshDb();
    const report = makeReport({ results: [] });
    expect(() => validateReport(db, report)).toThrow(InvalidReportError);
  });

  it('throws DuplicateRunError when run id already exists', () => {
    const db = freshDb();
    const report = makeReport();
    validateReport(db, report); // first call: ok, inserts nothing (validate only)
    // insert the run so it exists in the db
    ingestReport(db, JUNIT_XML, 'junit');
    // build a report with the same id as the junit fixture
    const dup = makeReport();
    (dup.run as { id: string }).id = 'run-junit-ingest-001';
    expect(() => validateReport(db, dup)).toThrow(DuplicateRunError);
  });

  it('InvalidReportError has the right class name', () => {
    const db = freshDb();
    const report = makeReport({ results: [] });
    try {
      validateReport(db, report);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as Error).name).toBe('InvalidReportError');
    }
  });

  it('DuplicateRunError has the right class name', () => {
    const db = freshDb();
    ingestReport(db, JUNIT_XML, 'junit');
    const dup = makeReport();
    (dup.run as { id: string }).id = 'run-junit-ingest-001';
    try {
      validateReport(db, dup);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as Error).name).toBe('DuplicateRunError');
    }
  });
});

// ──────────────────────────────────────────────
describe('REQ-001 ingestReport junit', () => {
  let db: DatabaseSync;

  beforeEach(() => { db = freshDb(); });

  it('parses a JUnit XML report and returns runId + results', () => {
    const { runId, results } = ingestReport(db, JUNIT_XML, 'junit');
    expect(runId).toBe('run-junit-ingest-001');
    expect(results).toHaveLength(2);
  });

  it('persists the run so a second ingest with the same id throws DuplicateRunError', () => {
    ingestReport(db, JUNIT_XML, 'junit');
    expect(() => ingestReport(db, JUNIT_XML, 'junit')).toThrow(DuplicateRunError);
  });

  it('classifies failure elements as failed', () => {
    const { results } = ingestReport(db, JUNIT_XML, 'junit');
    const failed = results.filter((r) => r.status === 'failed');
    expect(failed.length).toBeGreaterThan(0);
  });

  it('classifies self-closing testcases as passed', () => {
    const { results } = ingestReport(db, JUNIT_XML, 'junit');
    const passed = results.filter((r) => r.status === 'passed');
    expect(passed.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
describe('REQ-002 ingestReport json', () => {
  let db: DatabaseSync;

  beforeEach(() => { db = freshDb(); });

  it('parses a JSON report and returns runId + results', () => {
    const { runId, results } = ingestReport(db, JSON_REPORT, 'json');
    expect(runId).toBe('run-json-ingest-001');
    expect(results).toHaveLength(3);
  });

  it('persists the run so a second ingest with the same id throws DuplicateRunError', () => {
    ingestReport(db, JSON_REPORT, 'json');
    expect(() => ingestReport(db, JSON_REPORT, 'json')).toThrow(DuplicateRunError);
  });

  it('maps "failed" status correctly', () => {
    const { results } = ingestReport(db, JSON_REPORT, 'json');
    const failed = results.find((r) => r.testId === 'web::cart::adds-item');
    expect(failed?.status).toBe('failed');
  });

  it('maps "skipped" status correctly', () => {
    const { results } = ingestReport(db, JSON_REPORT, 'json');
    const skipped = results.find((r) => r.testId === 'web::home::dark-mode');
    expect(skipped?.status).toBe('skipped');
  });

  it('carries optional message field through', () => {
    const { results } = ingestReport(db, JSON_REPORT, 'json');
    const failed = results.find((r) => r.testId === 'web::cart::adds-item');
    expect(failed?.message).toBe('timeout');
  });
});
