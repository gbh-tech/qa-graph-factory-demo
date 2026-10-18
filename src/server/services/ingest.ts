import { DatabaseSync } from 'node:sqlite';
import type { Status, ParsedReport, TestResult } from '../../shared/types.ts';
import type { ReportFormat } from '../../shared/types.ts';
import { InvalidReportError, DuplicateRunError, ReportTooLargeError } from '../errors.ts';
import { MAX_REPORT_BYTES } from '../config.ts';
import { runExists, insertRun } from '../db/repos/runsRepo.ts';
import { insertResults } from '../db/repos/resultsRepo.ts';
import { PARSERS } from '../parsers/index.ts';

export function classifyResult(raw: string): Status {
  const s = raw.toLowerCase();
  if (s === 'pass' || s === 'ok' || s === 'success' || s === 'passed') return 'passed';
  if (s === 'fail' || s === 'failure' || s === 'failed') return 'failed';
  if (s === 'error') return 'error';
  if (s === 'skip' || s === 'skipped' || s === 'pending' || s === 'ignored') return 'skipped';
  return 'skipped';
}

export function validateReport(db: DatabaseSync, report: ParsedReport): void {
  if (!report.run.id || !report.run.suite) {
    throw new InvalidReportError('Report is missing required run fields (id, suite)');
  }
  if (!report.results || report.results.length === 0) {
    throw new InvalidReportError('Report contains no results');
  }
  if (runExists(db, report.run.id)) {
    throw new DuplicateRunError(`Run id "${report.run.id}" already exists`);
  }
}

export function ingestReport(
  db: DatabaseSync,
  text: string,
  format: ReportFormat
): { runId: string; results: TestResult[] } {
  if (Buffer.byteLength(text, 'utf8') > MAX_REPORT_BYTES) {
    throw new ReportTooLargeError(`Report exceeds ${MAX_REPORT_BYTES} bytes`);
  }

  const parsed = PARSERS[format](text);
  validateReport(db, parsed);
  insertRun(db, parsed.run);
  insertResults(db, parsed.results);

  return { runId: parsed.run.id, results: parsed.results };
}
