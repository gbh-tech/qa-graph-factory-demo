import type { ReportFormat, ParsedReport } from '../../shared/types.ts';
import { parseJunitXml } from './junit.ts';
import { parseJsonReport } from './json.ts';

export const PARSERS: Record<ReportFormat, (text: string) => ParsedReport> = {
  junit: parseJunitXml,
  json: parseJsonReport,
};
