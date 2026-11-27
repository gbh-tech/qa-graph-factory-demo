# Agent notes

See `CLAUDE.md` for the project rules (graph-friendly coding, deliberate plants).

## Factory job environment

Jobs run the scripts in `factory/`. Change them in the same change as anything a job needs:
a new dependency manager or tool version, a new service or port (`factory/compose.yml`),
a new variable, a changed command, a new test suite. Prove the change with `factory-env validate`
and `factory-env run test`. Services run on 127.0.0.1 at the ports
in `factory/compose.yml`; there is no Docker inside a job.

Project facts: no external services (SQLite via `node:sqlite`, Node 24). The gate runs `npm run typecheck`
and Vitest (`tests/unit`, `tests/integration`); Playwright e2e (`npm run test:e2e`) is not in the gate.
