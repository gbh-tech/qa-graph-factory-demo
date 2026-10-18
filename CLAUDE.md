# qa-graph-demo (TestPulse)

Demo app for the talk "Grafos de conocimiento aplicados a QA". The code exists to make the questions in `docs/guion-demo.md` answerable by a graphify knowledge graph. **Every change must keep those answers true.**

Stack: Node 24, TypeScript via `tsx`, Express 5, built-in `node:sqlite`, Vite + vanilla TS dashboard, Vitest (unit + integration with supertest), Playwright (E2E). No other dependencies without asking.

## Graph-friendly coding rules (mandatory)
- All domain logic is a named `export function foo()` — never anonymous arrows or classes with methods for logic. Names in `docs/requisitos.md` must match exactly.
- Tests import functions by name and call them directly (creates `calls` edges).
- Errors are named classes in `src/server/errors.ts`. Error-path tests use `toThrow(ClassName)` / check `error: 'ClassName'`.
- No barrel files / re-exports. Import from the defining file.
- Code, identifiers and UI in English. `docs/` in Spanish.

## Deliberate plants (DO NOT "fix")
1. `ReportTooLargeError` is thrown by `ingestReport` but **no test references it** (Q2).
2. `exportRunCsv` (REQ-008) has **no test** (Q3).
3. `formatDuration` has a unit test but **no requirement** (Q3).
4. Parsers are dispatched dynamically via `PARSERS[format]` in `src/server/parsers/index.ts`, so `ingestReport` has no static call edge to `parseJunitXml` / `parseJsonReport` (Q6 blind spot).
5. `INGEST_TIMEOUT_MS` lives in `src/server/config.ts` — a grep question, not a graph one (Q7).

## Commands
`npm run seed` · `npm run dev` (API :3000) · `npm run dev:web` (dashboard) · `npm test` · `npm run test:e2e` · `npm run typecheck`
