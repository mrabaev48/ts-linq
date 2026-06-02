---
status: not-started
phase: phase-x
package: integration-tests
priority: P1
effort: M
risk: medium
category: testing
depends_on: []
related: ["e2e-tests/task-2.md"]
---

# Refactor: Eliminate `if (!url) return` false-green skips

## Problem

Integration tests use two incompatible strategies for "skip when no DB available". One of
them — `if (!url) return;` inside a live `it(...)` — makes a test that **never executed**
report as **passing**. This silently hides missing coverage: a green suite can mean "all
DB tests were skipped", indistinguishable from "all DB tests passed".

## Evidence

- `packages/integration-tests/tests-new/postgres/postgres.integration.test.ts:5-6` —
  `it('connects and runs simple query', async () => { if (!url) return; ... })`. When
  `POSTGRES_URL` is unset the body returns immediately and Jest marks the test **passed**.
- Contrast `packages/integration-tests/tests-new/mysql/errors.integration.test.ts:11-13` —
  `const pgD = PG ? describe : describe.skip;` which correctly produces a *skipped* test in
  the report.
- `grep` shows the `if (!url) return` / `if (!env) return` pattern recurs across several
  smoke files; the two strategies coexist with no convention.

## Why this is bad

- A CI run with no databases shows all green, so a developer cannot tell coverage actually
  ran. This is the most dangerous class of test smell — a test that cannot fail.
- The two strategies make the suite's true coverage unauditable.
- It undermines the value of the whole integration tier: passing no longer implies tested.

## Why this is bad (catch-block audit)

No catch block; the `return` is an implicit silent skip — functionally a swallowed
"untested" state reported as success.

## Target architecture

Apply **fail-visibly** + a single **capability/availability gate** (Clean Code: tests must
either run and assert, or be explicitly skipped — never silently no-op):

- One shared helper, e.g. `describeIfDb(provider)` returning `describe` or `describe.skip`
  based on a typed availability check (env URL present and/or `RUN_DB_TESTS`).
- No `it` body may begin with `if (!url) return;`.

## Proposed refactor

1. Add a `describeIfDb(provider: 'postgres'|'mysql'|'mssql')` helper (ideally in
   `@ts-linq/testkits`, shared with e2e) that maps availability → `describe`/`describe.skip`.
2. Replace every `if (!url) return;` body-guard with the gate at the `describe` level.
3. Add a lint/grep guard in CI that fails if `if (!url) return` reappears in test bodies.

## Suggested design patterns

- **Guard at the suite boundary (Strategy)** — choose `describe` vs `describe.skip` once.
  WHY: produces a visible "skipped" status instead of a fake pass.
- **Shared factory helper** — one availability predicate. WHY: removes per-file divergence.

## Testing plan

- Run the suite with no DB env: assert reports show *skipped*, not *passed*, for DB suites.
- Run with DB env: suites execute and assert.
- CI grep guard test rejects the `if (!url) return` pattern.

## Acceptance criteria

- [ ] No `if (!url) return` (or equivalent body-guard) remains in any integration test.
- [ ] All DB-dependent suites gate via the shared `describeIfDb`/`describe.skip` helper.
- [ ] With no DB env, DB suites report as skipped (not passed).
- [ ] A CI guard prevents reintroduction of the body-guard pattern.

## Refactor order

1. Add shared `describeIfDb` helper.
2. Convert smoke files (`*.integration.test.ts` using `if (!url) return`).
3. Add CI grep guard.

## Notes

- Coordinate placement of `describeIfDb` with e2e (e2e/task-2 covers the same gating need).
