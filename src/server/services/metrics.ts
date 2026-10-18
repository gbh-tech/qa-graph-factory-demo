import type { TestResult, TestRun, FlakyTest, TrendPoint } from '../../shared/types.ts';

export function calculatePassRate(results: TestResult[]): number {
  const relevant = results.filter(
    (r) => r.status === 'passed' || r.status === 'failed' || r.status === 'error'
  );
  if (relevant.length === 0) return 0;
  const passed = relevant.filter((r) => r.status === 'passed').length;
  return passed / relevant.length;
}

export function detectFlakyTests(results: TestResult[]): FlakyTest[] {
  const byTest = new Map<string, TestResult[]>();
  for (const r of results) {
    const list = byTest.get(r.testId) ?? [];
    list.push(r);
    byTest.set(r.testId, list);
  }

  const flaky: FlakyTest[] = [];
  for (const [testId, testResults] of byTest) {
    const relevant = testResults.filter(
      (r) => r.status === 'passed' || r.status === 'failed'
    );
    if (relevant.length < 3) continue;

    let flips = 0;
    let prev = relevant[0].status;
    for (let i = 1; i < relevant.length; i++) {
      if (relevant[i].status !== prev) {
        flips++;
        prev = relevant[i].status;
      }
    }

    const failRate =
      relevant.filter((r) => r.status === 'failed').length / relevant.length;
    // A genuinely flaky test alternates frequently AND has a meaningful fail rate (≥15%).
    // Tests that only fail randomly at low rates are not considered flaky.
    if (flips >= 2 && failRate >= 0.25 && failRate <= 0.85) {
      flaky.push({ testId, name: relevant[0].name, flips, failRate });
    }
  }
  return flaky;
}

export function buildTrend(results: TestResult[], runs: TestRun[], days = 30): TrendPoint[] {
  const runDate = new Map<string, string>();
  for (const run of runs) {
    runDate.set(run.id, run.startedAt.slice(0, 10));
  }

  const byDate = new Map<string, TestResult[]>();
  const runsByDate = new Map<string, Set<string>>();

  for (const run of runs) {
    const date = run.startedAt.slice(0, 10);
    const s = runsByDate.get(date) ?? new Set<string>();
    s.add(run.id);
    runsByDate.set(date, s);
  }

  for (const r of results) {
    const date = runDate.get(r.runId);
    if (!date) continue;
    const list = byDate.get(date) ?? [];
    list.push(r);
    byDate.set(date, list);
  }

  const trend: TrendPoint[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const dayResults = byDate.get(date) ?? [];
    trend.push({
      date,
      passRate: calculatePassRate(dayResults),
      runs: runsByDate.get(date)?.size ?? 0,
    });
  }
  return trend;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}
