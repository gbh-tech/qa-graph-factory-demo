import { describe, it, expect } from 'vitest';
import type { TestResult, TestRun } from '../../src/shared/types.ts';
import { calculatePassRate } from '../../src/server/services/metrics.ts';
import { detectFlakyTests } from '../../src/server/services/metrics.ts';
import { buildTrend } from '../../src/server/services/metrics.ts';
import { formatDuration } from '../../src/server/services/metrics.ts';

function makeResult(
  runId: string,
  testId: string,
  status: TestResult['status'],
  name = testId
): TestResult {
  return { runId, testId, name, status, durationMs: 10 };
}

function makeRun(id: string, startedAt: string): TestRun {
  return { id, suite: 'test', branch: 'main', commit: 'abc', startedAt, durationMs: 1000 };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

// ──────────────────────────────────────────────
describe('REQ-005 calculatePassRate', () => {
  it('returns 0 for empty results', () => {
    expect(calculatePassRate([])).toBe(0);
  });

  it('excludes skipped from the denominator', () => {
    const results = [
      makeResult('r1', 't1', 'passed'),
      makeResult('r1', 't2', 'passed'),
      makeResult('r1', 't3', 'skipped'),
    ];
    expect(calculatePassRate(results)).toBe(1);
  });

  it('counts skipped-only set as 0 (no relevant results)', () => {
    const results = [
      makeResult('r1', 't1', 'skipped'),
      makeResult('r1', 't2', 'skipped'),
    ];
    expect(calculatePassRate(results)).toBe(0);
  });

  it('treats error status as failure (reduces pass rate)', () => {
    const results = [
      makeResult('r1', 't1', 'passed'),
      makeResult('r1', 't2', 'passed'),
      makeResult('r1', 't3', 'error'),
    ];
    // 2 passed / 3 relevant
    expect(calculatePassRate(results)).toBeCloseTo(2 / 3);
  });

  it('computes pass rate for mixed statuses ignoring skipped', () => {
    const results = [
      makeResult('r1', 't1', 'passed'),
      makeResult('r1', 't2', 'failed'),
      makeResult('r1', 't3', 'skipped'),
      makeResult('r1', 't4', 'passed'),
    ];
    // 2 passed / 3 relevant (skipped excluded)
    expect(calculatePassRate(results)).toBeCloseTo(2 / 3);
  });

  it('returns 1 when all tests pass', () => {
    const results = [
      makeResult('r1', 't1', 'passed'),
      makeResult('r1', 't2', 'passed'),
    ];
    expect(calculatePassRate(results)).toBe(1);
  });

  it('returns 0 when all tests fail', () => {
    const results = [
      makeResult('r1', 't1', 'failed'),
      makeResult('r1', 't2', 'failed'),
    ];
    expect(calculatePassRate(results)).toBe(0);
  });
});

// ──────────────────────────────────────────────
describe('REQ-004 detectFlakyTests', () => {
  it('detects a test with alternating pass/fail as flaky', () => {
    // 4 results: passed, failed, passed, failed → flips=3, failRate=0.5
    const results = [
      makeResult('r1', 'flaky-test', 'passed'),
      makeResult('r2', 'flaky-test', 'failed'),
      makeResult('r3', 'flaky-test', 'passed'),
      makeResult('r4', 'flaky-test', 'failed'),
    ];
    const flaky = detectFlakyTests(results);
    expect(flaky).toHaveLength(1);
    expect(flaky[0].testId).toBe('flaky-test');
    expect(flaky[0].flips).toBeGreaterThanOrEqual(2);
    expect(flaky[0].failRate).toBeCloseTo(0.5);
  });

  it('excludes tests with fewer than 3 relevant results', () => {
    const results = [
      makeResult('r1', 'sparse', 'passed'),
      makeResult('r2', 'sparse', 'failed'),
    ];
    expect(detectFlakyTests(results)).toHaveLength(0);
  });

  it('excludes tests with fewer than 2 flips (consistently passing or failing)', () => {
    const results = [
      makeResult('r1', 'stable-pass', 'passed'),
      makeResult('r2', 'stable-pass', 'passed'),
      makeResult('r3', 'stable-pass', 'passed'),
    ];
    expect(detectFlakyTests(results)).toHaveLength(0);
  });

  it('excludes tests where failRate < 0.25 (rare failures, not flaky)', () => {
    // 1 fail in 8 = 12.5%; two flips present but rate too low
    const results = [
      makeResult('r1', 'low-fail', 'passed'),
      makeResult('r2', 'low-fail', 'failed'),
      makeResult('r3', 'low-fail', 'passed'),
      makeResult('r4', 'low-fail', 'passed'),
      makeResult('r5', 'low-fail', 'passed'),
      makeResult('r6', 'low-fail', 'passed'),
      makeResult('r7', 'low-fail', 'passed'),
      makeResult('r8', 'low-fail', 'passed'),
    ];
    expect(detectFlakyTests(results)).toHaveLength(0);
  });

  it('excludes tests where failRate > 0.85 (consistently failing)', () => {
    // 6 fail in 7 = ~85.7%, two flips present but rate too high
    const results = [
      makeResult('r1', 'hi-fail', 'failed'),
      makeResult('r2', 'hi-fail', 'passed'),
      makeResult('r3', 'hi-fail', 'failed'),
      makeResult('r4', 'hi-fail', 'failed'),
      makeResult('r5', 'hi-fail', 'failed'),
      makeResult('r6', 'hi-fail', 'failed'),
      makeResult('r7', 'hi-fail', 'failed'),
    ];
    expect(detectFlakyTests(results)).toHaveLength(0);
  });

  it('ignores skipped and error results when computing flakiness', () => {
    // Only passed/failed are considered; skipped injected between them
    const results = [
      makeResult('r1', 'mixed', 'passed'),
      makeResult('r2', 'mixed', 'skipped'),
      makeResult('r3', 'mixed', 'failed'),
      makeResult('r4', 'mixed', 'skipped'),
      makeResult('r5', 'mixed', 'passed'),
      makeResult('r6', 'mixed', 'failed'),
    ];
    // relevant (passed/failed): p,f,p,f → flips=3, failRate=0.5 → flaky
    const flaky = detectFlakyTests(results);
    expect(flaky).toHaveLength(1);
  });

  it('handles multiple test ids and identifies only the flaky one', () => {
    const stable = [
      makeResult('r1', 'stable', 'passed'),
      makeResult('r2', 'stable', 'passed'),
      makeResult('r3', 'stable', 'passed'),
    ];
    const flaky = [
      makeResult('r1', 'flaky', 'passed'),
      makeResult('r2', 'flaky', 'failed'),
      makeResult('r3', 'flaky', 'passed'),
      makeResult('r4', 'flaky', 'failed'),
    ];
    const all = [...stable, ...flaky];
    const result = detectFlakyTests(all);
    expect(result).toHaveLength(1);
    expect(result[0].testId).toBe('flaky');
  });
});

// ──────────────────────────────────────────────
describe('REQ-006 buildTrend', () => {
  it('returns exactly 30 data points by default', () => {
    const trend = buildTrend([], []);
    expect(trend).toHaveLength(30);
  });

  it('returns the requested number of days', () => {
    const trend = buildTrend([], [], 7);
    expect(trend).toHaveLength(7);
  });

  it('dates are in YYYY-MM-DD format and ascending', () => {
    const trend = buildTrend([], []);
    expect(trend[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(trend[trend.length - 1].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(trend[0].date < trend[trend.length - 1].date).toBe(true);
  });

  it('last date in trend is today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const trend = buildTrend([], []);
    expect(trend[trend.length - 1].date).toBe(today);
  });

  it('populates passRate and runs for days with data', () => {
    const run1 = makeRun('run-trend-1', daysAgo(5));
    const results = [
      makeResult('run-trend-1', 't1', 'passed'),
      makeResult('run-trend-1', 't2', 'passed'),
      makeResult('run-trend-1', 't3', 'failed'),
    ];
    const trend = buildTrend(results, [run1]);
    const dayEntry = trend.find((p) => p.date === run1.startedAt.slice(0, 10));
    expect(dayEntry).toBeDefined();
    expect(dayEntry!.runs).toBe(1);
    expect(dayEntry!.passRate).toBeCloseTo(2 / 3);
  });

  it('days with no runs have passRate=0 and runs=0', () => {
    const trend = buildTrend([], []);
    for (const p of trend) {
      expect(p.passRate).toBe(0);
      expect(p.runs).toBe(0);
    }
  });
});

// ──────────────────────────────────────────────
// deliberate plant: no REQ id in this describe block
describe('formatDuration', () => {
  it('formats sub-minute durations as seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats zero milliseconds as 0s', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats exactly one minute', () => {
    expect(formatDuration(60_000)).toBe('1m 00s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90_000)).toBe('1m 30s');
  });

  it('pads seconds with leading zero', () => {
    expect(formatDuration(65_000)).toBe('1m 05s');
  });

  it('handles large durations', () => {
    expect(formatDuration(7_265_000)).toBe('121m 05s');
  });
});
