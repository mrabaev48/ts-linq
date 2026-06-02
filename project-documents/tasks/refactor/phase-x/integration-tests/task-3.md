---
status: not-started
phase: phase-x
package: integration-tests
priority: P2
effort: M
risk: medium
category: error-handling
depends_on: ["integration-tests/task-2.md"]
related: []
---

# Refactor: Fix swallowed teardown catch blocks and guarantee isolation

## Problem

Integration tests perform DDL teardown inside inline `try {} catch {}` blocks that swallow
all errors. When a `DROP TABLE` fails, the failure is hidden; leftover tables then leak into
later tests, causing order-dependent flakiness that is hard to diagnose.

## Evidence

- `packages/integration-tests/tests-new/mysql/errors.integration.test.ts:44-50` —
  ```ts
  } finally {
    try { await p.executeNonQuery('DROP TABLE IF EXISTS "child"'); } catch {}
    try { await p.executeNonQuery('DROP TABLE IF EXISTS "parent"'); } catch {}
  }
  ```
  Both catch blocks are empty — any drop failure is silently discarded.
- The same empty-catch teardown pattern recurs in the error/constraint integration files
  across the three dialect directories (they share the structure).
- Manual `DROP TABLE IF EXISTS` setup/teardown is inlined per test rather than centralised,
  so there is no enforced isolation boundary.

## Why this is bad (catch-block audit)

These catch blocks are **invalid silent swallows**: a teardown that fails leaves state behind
but reports nothing. Classification: unsafe — hides cleanup failure and creates cross-test
contamination. The correct behaviour is to surface (or at minimum log) teardown errors and to
guarantee a clean schema before each suite.

## Why this is bad

- Order-dependent flakiness: a leftover `parent`/`child` table from a failed drop changes the
  outcome of unrelated later tests.
- Debugging is hard because the originating failure was discarded.
- Inline teardown duplicates cleanup logic and cannot enforce a consistent isolation policy.

## Target architecture

Apply **fail-loud teardown** + **centralised isolation** (Clean Code: cleanup is a contract,
not best-effort):

- Move setup/teardown into the shared fixture from integration-tests/task-2, which performs a
  deterministic schema reset (drop-and-recreate or truncate) **before** each suite, so a
  prior failure cannot leak.
- Teardown errors are logged/aggregated, not swallowed; an unexpected drop failure fails the
  suite or emits a visible warning.

## Proposed refactor

1. Centralise schema reset in the shared fixture (`beforeAll`/`afterAll`).
2. Replace inline `try { drop } catch {}` with the fixture's reset; remove empty catches.
3. Where a best-effort drop is genuinely required, log the error
   (`console.warn(err)`), never `catch {}`.

## Suggested design patterns

- **Fixture / Template Method** — `beforeAll: reset; afterAll: reset`. WHY: guarantees a
  clean slate independent of prior failures.
- **Fail-loud cleanup** — surface teardown errors. WHY: removes invisible contamination.

## Testing plan

- Inject a deliberately failing drop and assert the fixture surfaces it (warns/fails) rather
  than swallowing.
- Run a dialect directory twice in sequence to prove no cross-test table leakage.

## Acceptance criteria

- [ ] No empty `catch {}` in integration teardown.
- [ ] Schema reset is centralised in the shared fixture, applied before each suite.
- [ ] Teardown failures are logged or fail the suite.
- [ ] Re-running a dialect directory is deterministic (no leftover-table flakiness).

## Refactor order

1. Land the shared fixture (task-2).
2. Add reset-before-suite + loud teardown.
3. Strip inline empty catches.

## Notes

- Depends on task-2's fixture as the single teardown owner.
