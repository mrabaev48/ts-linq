---
status: not-started
phase: phase-x
package: integration-tests
priority: P1
effort: L
risk: medium
category: testing
depends_on: ["testkits/task-1.md"]
related: []
---

# Refactor: Extract a shared provider fixture and kill instantiation boilerplate

## Problem

39 integration test files manually construct a real provider and re-parse the same
environment variables inline. There is no shared fixture for connect/configure/teardown, so
connection config drifts file-to-file and every new test copy-pastes provider setup.

## Evidence

- `packages/integration-tests/tests-new/postgres/postgres.integration.test.ts:7-13` —
  inline `new PostgresProvider({ host: process.env.POSTGRES_HOST || 'localhost', port: ...,
  database: process.env.POSTGRES_DB || 'test', user: ... })`.
- `packages/integration-tests/tests-new/mysql/errors.integration.test.ts:18-24` — same
  pattern repeated for Postgres inside the MySQL error file, plus MySQL/MSSQL variants.
- `grep PostgresProvider|MySqlProvider|MssqlProvider tests-new` → 39 files instantiate
  providers directly.
- Inline defaults disagree with the global setup script: tests default
  `POSTGRES_DB || 'test'` / port `5432`
  (`postgres.integration.test.ts:9-10`) while the global setup advertises `POSTGRES_DB=testdb`
  / port `6543` (`scripts/jest-db-global-setup.js:23,29`).

## Why this is bad

- DRY violation at scale: provider config is defined 39 times with subtle divergences.
- Config drift between inline defaults and the global setup means tests can connect to the
  wrong database/port depending on how they were launched.
- No single place to enforce isolation (fresh schema per file), so teardown discipline is
  ad-hoc.

## Target architecture

Apply **DRY**, **composition-first**, and the **Factory + Fixture** patterns:

- A shared `getProvider(provider)` / `withProvider(provider, fn)` fixture (in `@ts-linq/
  testkits`, reused by e2e `setup.ts`) that reads connection config from a single source of
  truth and returns a connected provider with a guaranteed teardown.
- A single `connectionConfig(provider)` resolver consumed by both the fixture and the global
  setup script, eliminating the inline-default vs global-setup divergence.

## Proposed refactor

1. Define one `connectionConfig(provider)` resolver (single env source of truth).
2. Add `withProvider(provider, fn)` (or a `beforeAll`/`afterAll` fixture) in testkits that
   connects, yields the provider, and tears down (drop tables / disconnect).
3. Migrate the 39 files to the fixture; delete inline provider construction.
4. Align `e2e-tests/src/setup.ts` to the same resolver (removes its bespoke `parse*Url`
   functions).

## Suggested design patterns

- **Factory** — `getProvider(provider)` centralises construction. WHY: one config, no drift.
- **Fixture (RAII-style)** — `withProvider` guarantees teardown. WHY: consistent isolation.
- **Single Source of Truth** — `connectionConfig`. WHY: kills inline-vs-global divergence.

## Testing plan

- A unit test for `connectionConfig` proving env precedence and defaults match the global
  setup script.
- Smoke-run a migrated dialect file to confirm parity with the old inline setup.

## Acceptance criteria

- [ ] One `connectionConfig(provider)` resolver used by tests, fixture, and global setup.
- [ ] `withProvider`/fixture provides connect + guaranteed teardown.
- [ ] All 39 files use the fixture; no inline `new XProvider({...env...})` remains.
- [ ] Inline-default vs global-setup port/db divergence is eliminated.

## Refactor order

1. Build `connectionConfig` + `withProvider` in testkits.
2. Migrate one dialect directory; verify.
3. Migrate the rest; align e2e setup.

## Notes

- Depends on testkits/task-1 (contract harness) since the fixture is the natural seam the
  harness plugs into.
