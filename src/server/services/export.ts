import type { TestRun, TestResult } from '../../shared/types.ts';

export function exportRunCsv(run: TestRun, results: TestResult[]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = 'runId,testId,name,status,durationMs,message';
  const rows = results.map((r) =>
    [
      escape(r.runId),
      escape(r.testId),
      escape(r.name),
      escape(r.status),
      r.durationMs,
      escape(r.message ?? ''),
    ].join(',')
  );
  void run; // run metadata available if callers need it
  return [header, ...rows].join('\n');
}
