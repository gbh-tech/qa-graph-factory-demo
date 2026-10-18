# API contract

All JSON. Server on `PORT` (default 3000). Vite dev server proxies `/api` to it.

| Method | Path | Handler | Body / Response |
|---|---|---|---|
| POST | /api/runs?format=junit\|json | `createRunHandler` | raw body (XML or JSON text) → `201 { runId, results }`; `400` InvalidReportError, `409` DuplicateRunError, `413` ReportTooLargeError |
| GET | /api/runs?limit=20 | `listRunsHandler` | `(TestRun & { passRate })[]` newest first |
| GET | /api/runs/:id | `getRunHandler` | `{ run: TestRun, results: TestResult[] }`, `404` if missing |
| GET | /api/runs/:id/export | `exportRunHandler` | `text/csv` from `exportRunCsv` |
| GET | /api/dashboard | `getDashboardSummary` | `DashboardSummary` (see `src/shared/types.ts`) |

Error body: `{ error: <ErrorClassName>, message }`.

JSON report format (`format=json`):
```json
{ "run": { "id": "run-x", "suite": "api", "branch": "main", "commit": "abc123", "startedAt": "2026-10-01T10:00:00Z", "durationMs": 12000 },
  "results": [ { "testId": "api::auth.spec::logs in", "name": "logs in", "status": "pass", "durationMs": 120 } ] }
```
Raw `status` strings go through `classifyResult` (pass/ok/success → passed, fail/failure → failed, error → error, skip/skipped/pending/ignored → skipped).

JUnit XML: standard `<testsuite name hostname timestamp time><testcase classname name time><failure|error|skipped/></testcase></testsuite>`; run id/branch/commit come from `<properties>` (`run.id`, `branch`, `commit`).
