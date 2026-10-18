// Shared domain types used by server, web and tests.

export type Status = 'passed' | 'failed' | 'skipped' | 'error';

export type ReportFormat = 'junit' | 'json';

export interface TestRun {
  id: string;            // e.g. "run-2026-10-01-web-01"
  suite: string;         // "api" | "web" | "mobile" | "payments"
  branch: string;
  commit: string;
  startedAt: string;     // ISO-8601
  durationMs: number;
}

export interface TestResult {
  runId: string;
  testId: string;        // stable id: "<suite>::<file>::<name>"
  name: string;
  status: Status;
  durationMs: number;
  message?: string;      // failure message
}

export interface Defect {
  id: string;            // "BUG-101"
  testId: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  open: boolean;
}

export interface Requirement {
  id: string;            // "REQ-001"
  title: string;
}

/** Normalized report produced by every parser before ingestion. */
export interface ParsedReport {
  run: TestRun;
  results: TestResult[];
}

export interface FlakyTest {
  testId: string;
  name: string;
  flips: number;         // pass<->fail transitions in the window
  failRate: number;      // 0..1
}

export interface TrendPoint {
  date: string;          // YYYY-MM-DD
  passRate: number;      // 0..1
  runs: number;
}

export interface DashboardSummary {
  passRate: number;      // 0..1, last 30 days
  totalRuns: number;
  flakyCount: number;
  openDefects: number;
  trend: TrendPoint[];
  flaky: FlakyTest[];
  recentRuns: (TestRun & { passRate: number })[];
}
