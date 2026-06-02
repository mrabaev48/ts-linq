---
status: not-started
phase: phase-x
package: e2e-tests
priority: P1
effort: M
risk: medium
category: testing
depends_on: ["integration-tests/task-2.md"]
related: ["integration-tests/task-1.md"]
---

# Refactor: Unify provider naming, connection config, and visible skip gating

## Problem

The e2e package uses three inconsistent names for the same database and a bespoke connection
parser that diverges from the integration global setup. Combined with env-presence skipping,
this makes it easy to run against the wrong database — or to think coverage ran when it
silently did not.

## Evidence

- `packages/e2e-tests/src/setup.ts:58` — `setupTestDatabase(provider: 'postgresql' | 'mysql'
  | 'mssql')` uses the literal `'postgresql'`.
- `packages/e2e-tests/package.json:8` — `"test:postgres": "jest --testNamePattern=postgres"`
  uses `postgres`.
- `packages/e2e-tests/README.md:31` — documents `npm run test:postgresql` (a script that does
  **not** exist).
- `packages/e2e-tests/src/setup.ts:3-56` — bespoke `parsePostgresUrl`/`parseMysqlUrl`/
  `parseMssqlUrl` with defaults (Postgres port `5432`,
  `setup.ts:8`) that disagree with the integration global setup (`POSTGRES_PORT=6543`,
  `scripts/jest-db-global-setup.js:23`).

## Why this is bad

- Three names for one backend (`postgresql` / `postgres` / non-existent script) make the test
  matrix confusing and the README actively wrong.
- Divergent connection defaults mean e2e and integration can connect to different databases,
  producing inconsistent results that are hard to reconcile.
- Without a visible `describe.skip` gate, a missing-DB run can report passed (same false-green
  risk as integration-tests/task-1).

## Why this is bad (catch-block audit)

`setup.ts:13,29,47` use `} catch { return <defaults> }` in the URL parsers — these silently
fall back to hard-coded localhost defaults on a malformed URL, masking misconfiguration.
Classification: unsafe fallback — a typo'd connection string yields a silent default
connection instead of a clear error.

## Target architecture

Apply **single source of truth** + a shared **availability gate**:

- Reuse the `connectionConfig(provider)` resolver from integration-tests/task-2 (ideally in
  `@ts-linq/testkits`) for both e2e and integration; delete the bespoke `parse*Url` functions.
- Standardise one provider key (`'postgres' | 'mysql' | 'mssql'`) across setup, scripts, and
  README.
- Use the shared `describeIfDb` gate (integration-tests/task-1) so no-DB runs report skipped.
- Make URL parse failures throw a clear error rather than returning localhost defaults.

## Proposed refactor

1. Replace `setup.ts` `parse*Url` with the shared `connectionConfig` resolver.
2. Rename the `'postgresql'` key to `'postgres'` everywhere; align package.json scripts.
3. Apply `describeIfDb` to e2e suites.
4. Throw on malformed connection strings instead of catch-and-default.
5. Fix the README to list real scripts and accurate env behaviour.

## Suggested design patterns

- **Single Source of Truth** — shared `connectionConfig`. WHY: e2e and integration agree on
  targets.
- **Strategy (suite gate)** — `describeIfDb`. WHY: visible skips, not fake passes.
- **Fail-fast** — throw on bad URL. WHY: surfaces misconfiguration immediately.

## Testing plan

- Unit test the shared resolver's precedence; assert e2e and integration resolve identically.
- No-DB run: e2e DB suites report skipped.
- Malformed `POSTGRES_URL`: setup throws a clear error.

## Acceptance criteria

- [ ] One provider key (`postgres`/`mysql`/`mssql`) across setup, scripts, README.
- [ ] `setup.ts` uses the shared `connectionConfig`; bespoke `parse*Url` removed.
- [ ] e2e DB suites gate via `describeIfDb` (visible skip).
- [ ] Malformed connection strings throw rather than defaulting.
- [ ] README scripts/env section matches reality.

## Refactor order

1. Land shared `connectionConfig` (integration-tests/task-2).
2. Rewire e2e setup + naming.
3. Apply gate + fail-fast.
4. Fix README.

## Notes

- Depends on integration-tests/task-2 for the shared resolver; shares the gate with
  integration-tests/task-1.
