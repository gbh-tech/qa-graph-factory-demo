import type { ParsedReport, TestRun, TestResult } from '../../shared/types.ts';
import { classifyResult } from '../services/ingest.ts';

function xmlAttr(tag: string, attr: string): string {
  const m = tag.match(new RegExp(`\\b${attr}=["']([^"']*)["']`));
  return m?.[1] ?? '';
}

function propValue(text: string, name: string): string {
  const esc = name.replace(/\./g, '\\.');
  const m = text.match(
    new RegExp(`<property[^>]+\\bname=["']${esc}["'][^>]+\\bvalue=["']([^"']*)["']`)
  );
  if (m) return m[1];
  const m2 = text.match(
    new RegExp(`<property[^>]+\\bvalue=["']([^"']*)["'][^>]+\\bname=["']${esc}["']`)
  );
  return m2?.[1] ?? '';
}

/** Split XML text into an array of raw <testcase .../> and <testcase ...>body</testcase> strings. */
function extractTestcases(text: string): Array<{ attrs: string; body: string }> {
  const results: Array<{ attrs: string; body: string }> = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('<testcase', i);
    if (start === -1) break;

    // Find the end of the opening tag
    let j = start + 9; // skip '<testcase'
    // Advance past the attributes (respect quoted values so we don't mistake > inside them)
    while (j < text.length && text[j] !== '>') {
      if (text[j] === '"') { j++; while (j < text.length && text[j] !== '"') j++; }
      else if (text[j] === "'") { j++; while (j < text.length && text[j] !== "'") j++; }
      j++;
    }
    // j is now at '>'
    const selfClosing = j > 0 && text[j - 1] === '/';
    const attrs = text.slice(start + 9, selfClosing ? j - 1 : j).trim();

    if (selfClosing) {
      results.push({ attrs, body: '' });
      i = j + 1;
    } else {
      // Find matching </testcase>
      const bodyStart = j + 1;
      const closeTag = '</testcase>';
      const closeIdx = text.indexOf(closeTag, bodyStart);
      if (closeIdx === -1) { i = j + 1; continue; }
      const body = text.slice(bodyStart, closeIdx);
      results.push({ attrs, body });
      i = closeIdx + closeTag.length;
    }
  }
  return results;
}

export function parseJunitXml(text: string): ParsedReport {
  const suiteTagMatch = text.match(/<testsuite([^>]*)>/);
  const suiteTag = suiteTagMatch?.[1] ?? '';

  const suiteName = xmlAttr(suiteTag, 'name') || 'unknown';
  const runId = propValue(text, 'run.id') || `junit-${Date.now()}`;
  const branch = propValue(text, 'branch') || 'main';
  const commit = propValue(text, 'commit') || 'unknown';

  const timestamp = xmlAttr(suiteTag, 'timestamp');
  const startedAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  const timeStr = xmlAttr(suiteTag, 'time');
  const durationMs = timeStr ? Math.round(parseFloat(timeStr) * 1000) : 0;

  const run: TestRun = { id: runId, suite: suiteName, branch, commit, startedAt, durationMs };

  const results: TestResult[] = extractTestcases(text).map(({ attrs, body }) => {
    const classname = xmlAttr(attrs, 'classname') || suiteName;
    const name = xmlAttr(attrs, 'name') || 'unknown';
    const time = xmlAttr(attrs, 'time');
    const dMs = time ? Math.round(parseFloat(time) * 1000) : 0;

    let rawStatus = 'pass';
    let message: string | undefined;

    if (/<failure/.test(body)) {
      rawStatus = 'failure';
      message =
        body.match(/<failure[^>]*>([\s\S]*?)<\/failure>/)?.[1]?.trim() ||
        xmlAttr(body, 'message');
    } else if (/<error/.test(body)) {
      rawStatus = 'error';
      message = body.match(/<error[^>]*>([\s\S]*?)<\/error>/)?.[1]?.trim();
    } else if (/<skipped/.test(body)) {
      rawStatus = 'skipped';
    }

    const testId = `${suiteName}::${classname}::${name}`;
    return { runId, testId, name, status: classifyResult(rawStatus), durationMs: dMs, message };
  });

  return { run, results };
}
