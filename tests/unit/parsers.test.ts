import { describe, it, expect } from 'vitest';
import { parseJunitXml } from '../../src/server/parsers/junit.ts';
import { parseJsonReport } from '../../src/server/parsers/json.ts';

const FULL_JUNIT = `<?xml version="1.0"?>
<testsuite name="api" tests="3" time="2.0" timestamp="2026-10-01T10:00:00">
  <properties>
    <property name="run.id" value="run-junit-parser-001"/>
    <property name="branch" value="feature/login"/>
    <property name="commit" value="deadbeef"/>
  </properties>
  <testcase classname="api.auth" name="login" time="0.5"/>
  <testcase classname="api.auth" name="logout" time="0.3">
    <failure message="Expected 200">AssertionError: got 401</failure>
  </testcase>
  <testcase classname="api.health" name="ping" time="0.1">
    <skipped/>
  </testcase>
</testsuite>`;

const JSON_REPORT = JSON.stringify({
  run: {
    id: 'run-json-parser-001',
    suite: 'web',
    branch: 'main',
    commit: 'cafebabe',
    startedAt: '2026-10-01T11:00:00.000Z',
    durationMs: 4500,
  },
  results: [
    { testId: 'web::home::renders', name: 'renders', status: 'passed', durationMs: 50 },
    { testId: 'web::home::dark-mode', name: 'dark-mode', status: 'skipped', durationMs: 0 },
    { testId: 'web::cart::adds-item', name: 'adds-item', status: 'failed', durationMs: 120, message: 'timeout' },
    { testId: 'web::cart::crash', name: 'crash', status: 'error', durationMs: 5 },
  ],
});

// ──────────────────────────────────────────────
describe('REQ-001 parseJunitXml', () => {
  it('extracts run.id from properties', () => {
    const { run } = parseJunitXml(FULL_JUNIT);
    expect(run.id).toBe('run-junit-parser-001');
  });

  it('extracts suite name from testsuite name attribute', () => {
    const { run } = parseJunitXml(FULL_JUNIT);
    expect(run.suite).toBe('api');
  });

  it('extracts branch from properties', () => {
    const { run } = parseJunitXml(FULL_JUNIT);
    expect(run.branch).toBe('feature/login');
  });

  it('extracts commit from properties', () => {
    const { run } = parseJunitXml(FULL_JUNIT);
    expect(run.commit).toBe('deadbeef');
  });

  it('parses timestamp into ISO startedAt', () => {
    const { run } = parseJunitXml(FULL_JUNIT);
    expect(run.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('converts testsuite time attribute to durationMs', () => {
    const { run } = parseJunitXml(FULL_JUNIT);
    expect(run.durationMs).toBe(2000);
  });

  it('returns one TestResult per testcase element', () => {
    const { results } = parseJunitXml(FULL_JUNIT);
    expect(results).toHaveLength(3);
  });

  it('classifies self-closing testcase as passed', () => {
    const { results } = parseJunitXml(FULL_JUNIT);
    const login = results.find((r) => r.name === 'login');
    expect(login?.status).toBe('passed');
  });

  it('classifies testcase with <failure> as failed', () => {
    const { results } = parseJunitXml(FULL_JUNIT);
    const logout = results.find((r) => r.name === 'logout');
    expect(logout?.status).toBe('failed');
  });

  it('classifies testcase with <skipped> as skipped', () => {
    const { results } = parseJunitXml(FULL_JUNIT);
    const ping = results.find((r) => r.name === 'ping');
    expect(ping?.status).toBe('skipped');
  });

  it('builds stable testId from suite::classname::name', () => {
    const { results } = parseJunitXml(FULL_JUNIT);
    const login = results.find((r) => r.name === 'login');
    expect(login?.testId).toBe('api::api.auth::login');
  });

  it('attaches failure message to result', () => {
    const { results } = parseJunitXml(FULL_JUNIT);
    const logout = results.find((r) => r.name === 'logout');
    expect(logout?.message).toBeTruthy();
  });

  it('uses fallback run.id when property absent', () => {
    const xml = `<testsuite name="suite" tests="1" time="1.0" timestamp="2026-10-01T00:00:00">
      <testcase classname="a" name="b" time="1.0"/>
    </testsuite>`;
    const { run } = parseJunitXml(xml);
    expect(run.id).toMatch(/^junit-\d+$/);
  });
});

// ──────────────────────────────────────────────
describe('REQ-002 parseJsonReport', () => {
  it('extracts run.id', () => {
    const { run } = parseJsonReport(JSON_REPORT);
    expect(run.id).toBe('run-json-parser-001');
  });

  it('extracts suite', () => {
    const { run } = parseJsonReport(JSON_REPORT);
    expect(run.suite).toBe('web');
  });

  it('extracts branch', () => {
    const { run } = parseJsonReport(JSON_REPORT);
    expect(run.branch).toBe('main');
  });

  it('extracts commit', () => {
    const { run } = parseJsonReport(JSON_REPORT);
    expect(run.commit).toBe('cafebabe');
  });

  it('carries startedAt through', () => {
    const { run } = parseJsonReport(JSON_REPORT);
    expect(run.startedAt).toBe('2026-10-01T11:00:00.000Z');
  });

  it('carries durationMs through', () => {
    const { run } = parseJsonReport(JSON_REPORT);
    expect(run.durationMs).toBe(4500);
  });

  it('returns one TestResult per entry', () => {
    const { results } = parseJsonReport(JSON_REPORT);
    expect(results).toHaveLength(4);
  });

  it('normalises "passed" status', () => {
    const { results } = parseJsonReport(JSON_REPORT);
    const r = results.find((x) => x.testId === 'web::home::renders');
    expect(r?.status).toBe('passed');
  });

  it('normalises "skipped" status', () => {
    const { results } = parseJsonReport(JSON_REPORT);
    const r = results.find((x) => x.testId === 'web::home::dark-mode');
    expect(r?.status).toBe('skipped');
  });

  it('normalises "failed" status', () => {
    const { results } = parseJsonReport(JSON_REPORT);
    const r = results.find((x) => x.testId === 'web::cart::adds-item');
    expect(r?.status).toBe('failed');
  });

  it('normalises "error" status', () => {
    const { results } = parseJsonReport(JSON_REPORT);
    const r = results.find((x) => x.testId === 'web::cart::crash');
    expect(r?.status).toBe('error');
  });

  it('carries optional message field through', () => {
    const { results } = parseJsonReport(JSON_REPORT);
    const r = results.find((x) => x.testId === 'web::cart::adds-item');
    expect(r?.message).toBe('timeout');
  });

  it('populates runId on each result from run.id', () => {
    const { results } = parseJsonReport(JSON_REPORT);
    for (const r of results) {
      expect(r.runId).toBe('run-json-parser-001');
    }
  });

  it('throws on malformed JSON', () => {
    expect(() => parseJsonReport('{bad json')).toThrow();
  });
});
