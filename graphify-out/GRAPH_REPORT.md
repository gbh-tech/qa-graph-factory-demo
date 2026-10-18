# Graph Report - .  (2026-10-18)

## Corpus Check
- Corpus is ~11,505 words - fits in a single context window. You may not need a graph.

## Summary
- 178 nodes · 372 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Endpoints|API Endpoints]]
- [[_COMMUNITY_Project Config & Dependencies|Project Config & Dependencies]]
- [[_COMMUNITY_Integration Tests|Integration Tests]]
- [[_COMMUNITY_Report Parsers|Report Parsers]]
- [[_COMMUNITY_Requirements & Dashboard|Requirements & Dashboard]]
- [[_COMMUNITY_Database Layer|Database Layer]]
- [[_COMMUNITY_Shared Types|Shared Types]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_E2E Tests|E2E Tests]]
- [[_COMMUNITY_Run Detail API|Run Detail API]]

## God Nodes (most connected - your core abstractions)
1. `TestRun` - 12 edges
2. `TestResult` - 12 edges
3. `scripts` - 10 edges
4. `getDashboardSummary()` - 10 edges
5. `ingestReport()` - 10 edges
6. `compilerOptions` - 10 edges
7. `openDb()` - 7 edges
8. `applySchema()` - 7 edges
9. `InvalidReportError` - 7 edges
10. `DuplicateRunError` - 7 edges

## Surprising Connections (you probably didn't know these)
- `REQ-005: Pass Rate Calculation` --references--> `classifyResult()`  [EXTRACTED]
  docs/requisitos.md → src/server/services/ingest.ts
- `REQ-001: JUnit XML Report Ingestion` --references--> `parseJunitXml()`  [EXTRACTED]
  docs/requisitos.md → src/server/parsers/junit.ts
- `REQ-002: JSON Report Ingestion` --references--> `parseJsonReport()`  [EXTRACTED]
  docs/requisitos.md → src/server/parsers/json.ts
- `REQ-002: JSON Report Ingestion` --references--> `ingestReport()`  [EXTRACTED]
  docs/requisitos.md → src/server/services/ingest.ts
- `REQ-004: Flaky Test Detection` --references--> `detectFlakyTests()`  [EXTRACTED]
  docs/requisitos.md → src/server/services/metrics.ts

## Import Cycles
- 3-file cycle: `src/server/parsers/index.ts -> src/server/parsers/json.ts -> src/server/services/ingest.ts -> src/server/parsers/index.ts`
- 3-file cycle: `src/server/parsers/index.ts -> src/server/parsers/junit.ts -> src/server/services/ingest.ts -> src/server/parsers/index.ts`

## Hyperedges (group relationships)
- **Report Ingestion Pipeline (REQ-001/002)** — docs_requisitos_req_001, docs_requisitos_req_002, routes_runs_createrunhandler, services_ingest_ingestreport, parsers_junit_parsejunitxml, parsers_json_parsejsonreport [INFERRED 0.85]

## Communities (13 total, 1 thin omitted)

### Community 0 - "API Endpoints"
Cohesion: 0.13
Nodes (23): GET /api/runs (list runs endpoint), GET /api/runs/:id/export (CSV export endpoint), POST /api/runs (ingest report endpoint), REQ-001: JUnit XML Report Ingestion, REQ-002: JSON Report Ingestion, REQ-003: Report Validation, REQ-008: Export Run to CSV, findResultsByRun() (+15 more)

### Community 1 - "Project Config & Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, express, devDependencies, @playwright/test, supertest, tsx, @types/express, @types/node (+17 more)

### Community 2 - "Integration Tests"
Cohesion: 0.13
Nodes (18): daysAgo(), makeResult(), makeRun(), seedDb(), insertDefect(), insertResults(), insertRun(), ALWAYS_FAILING (+10 more)

### Community 3 - "Report Parsers"
Cohesion: 0.22
Nodes (13): PARSERS, parseJsonReport(), extractTestcases(), parseJunitXml(), propValue(), xmlAttr(), classifyResult(), ParsedReport (+5 more)

### Community 4 - "Requirements & Dashboard"
Cohesion: 0.19
Nodes (13): GET /api/dashboard (dashboard summary endpoint), REQ-004: Flaky Test Detection, REQ-005: Pass Rate Calculation, REQ-006: 30-Day Pass Rate Trend, REQ-007: Dashboard Summary, countOpenDefects(), findResultsSince(), getDashboardSummary() (+5 more)

### Community 5 - "Database Layer"
Cohesion: 0.20
Nodes (9): getDb(), openDb(), applySchema(), createApp(), PORT, app, db, freshDb() (+1 more)

### Community 6 - "Shared Types"
Cohesion: 0.19
Nodes (15): DashboardSummary, FlakyTest, TestRun, escape(), fmtMs(), fmtPct(), loadDashboard(), renderFlakyTable() (+7 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.17
Nodes (11): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 8 - "E2E Tests"
Cohesion: 0.40
Nodes (3): __dirname, FIXTURE_PATH, VIEWPORTS

## Knowledge Gaps
- **52 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:web` (+47 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ingestReport()` connect `API Endpoints` to `Integration Tests`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Why does `getDashboardSummary()` connect `Requirements & Dashboard` to `API Endpoints`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _52 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Project Config & Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Integration Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.13405797101449277 - nodes in this community are weakly interconnected._