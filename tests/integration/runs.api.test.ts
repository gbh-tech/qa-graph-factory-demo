import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../../src/server/db/connection.ts';
import { applySchema } from '../../src/server/db/schema.ts';
import { createApp } from '../../src/server/app.ts';

const JUNIT_RUN_ID = 'run-api-junit-001';
const JSON_RUN_ID = 'run-api-json-001';

const junitXml = (runId: string) => `<?xml version="1.0"?>
<testsuite name="api" tests="2" time="1.5" timestamp="2026-10-01T10:00:00">
  <properties>
    <property name="run.id" value="${runId}"/>
    <property name="branch" value="main"/>
    <property name="commit" value="deadbeef"/>
  </properties>
  <testcase classname="api.auth" name="login" time="0.5"/>
  <testcase classname="api.auth" name="logout" time="0.3">
    <failure message="Expected 200">AssertionError: got 401</failure>
  </testcase>
</testsuite>`;

const jsonReport = (runId: string) => JSON.stringify({
  run: {
    id: runId,
    suite: 'web',
    branch: 'main',
    commit: 'cafebabe',
    startedAt: '2026-10-01T11:00:00.000Z',
    durationMs: 2000,
  },
  results: [
    { testId: 'web::home::renders', name: 'renders', status: 'passed', durationMs: 50 },
    { testId: 'web::home::responsive', name: 'responsive', status: 'passed', durationMs: 60 },
  ],
});

const EMPTY_JUNIT = `<?xml version="1.0"?>
<testsuite name="api" tests="0" time="0" timestamp="2026-10-01T10:00:00">
  <properties>
    <property name="run.id" value="run-empty-no-results"/>
    <property name="branch" value="main"/>
    <property name="commit" value="abc123"/>
  </properties>
</testsuite>`;

describe('REQ-001/002/003/007 runs API', () => {
  let app: ReturnType<typeof createApp>;
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDb(':memory:');
    applySchema(db);
    app = createApp(db);
  });

  // REQ-001: accept JUnit XML
  it('POST /api/runs?format=junit returns 201 with runId and results', async () => {
    const res = await request(app)
      .post('/api/runs?format=junit')
      .set('Content-Type', 'text/plain')
      .send(junitXml(JUNIT_RUN_ID));
    expect(res.status).toBe(201);
    expect(res.body.runId).toBe(JUNIT_RUN_ID);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  // REQ-002: accept JSON
  it('POST /api/runs?format=json returns 201 with runId and results', async () => {
    const res = await request(app)
      .post('/api/runs?format=json')
      .set('Content-Type', 'text/plain')
      .send(jsonReport(JSON_RUN_ID));
    expect(res.status).toBe(201);
    expect(res.body.runId).toBe(JSON_RUN_ID);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results).toHaveLength(2);
  });

  // REQ-003: duplicate rejected
  it('POST /api/runs with a duplicate run id returns 409 DuplicateRunError', async () => {
    await request(app)
      .post('/api/runs?format=junit')
      .set('Content-Type', 'text/plain')
      .send(junitXml(JUNIT_RUN_ID));

    const res = await request(app)
      .post('/api/runs?format=junit')
      .set('Content-Type', 'text/plain')
      .send(junitXml(JUNIT_RUN_ID));

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DuplicateRunError');
  });

  // REQ-003: invalid report rejected
  it('POST /api/runs with no testcases returns 400 InvalidReportError', async () => {
    const res = await request(app)
      .post('/api/runs?format=junit')
      .set('Content-Type', 'text/plain')
      .send(EMPTY_JUNIT);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('InvalidReportError');
  });

  // REQ-007: list runs
  it('GET /api/runs returns an array', async () => {
    await request(app)
      .post('/api/runs?format=junit')
      .set('Content-Type', 'text/plain')
      .send(junitXml(JUNIT_RUN_ID));

    const res = await request(app).get('/api/runs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /api/runs list includes passRate on each entry', async () => {
    await request(app)
      .post('/api/runs?format=junit')
      .set('Content-Type', 'text/plain')
      .send(junitXml(JUNIT_RUN_ID));

    const res = await request(app).get('/api/runs');
    expect(res.status).toBe(200);
    expect(typeof res.body[0].passRate).toBe('number');
  });

  // REQ-007: get run by id
  it('GET /api/runs/:id returns run + results', async () => {
    await request(app)
      .post('/api/runs?format=junit')
      .set('Content-Type', 'text/plain')
      .send(junitXml(JUNIT_RUN_ID));

    const res = await request(app).get(`/api/runs/${JUNIT_RUN_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.run.id).toBe(JUNIT_RUN_ID);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  // REQ-007: 404 for unknown
  it('GET /api/runs/:id returns 404 for non-existent run', async () => {
    const res = await request(app).get('/api/runs/does-not-exist-xyz');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
  });
});
