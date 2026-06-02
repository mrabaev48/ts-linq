---
status: not-started
phase: phase-x
package: testkits
priority: P2
effort: S
risk: medium
category: sql
depends_on: []
related: ["e2e-tests/task-1.md"]
---

# Refactor: Fix or remove the broken `DatabaseHarness`

## Problem

`DatabaseHarness` emits **invalid SQL** in `createSchema` and derives table/column structure
from class names instead of metadata, making it unusable for real schema setup. It is also
barely used (only e2e `setup.ts` constructs it, and only for connect/teardown — never
`createSchema`/`seed`).

## Evidence

- `packages/testkits/src/harness/DatabaseHarness.ts:35` —
  `CREATE TABLE IF EXISTS ${tableName} (id INTEGER PRIMARY KEY)`. `IF EXISTS` is invalid for
  `CREATE TABLE`; the correct clause is `IF NOT EXISTS`. The schema is also hard-coded to a
  single `id INTEGER PRIMARY KEY` column regardless of the entity.
- `:67-69` — `getTableName` uses `entity.name.toLowerCase()`, ignoring `MetadataStorage`
  table/column mapping, so generated DDL/DML cannot match real entities.
- `packages/e2e-tests/src/setup.ts:59,103` — the only construction site uses
  `harness.setup({ autoConnect: false })` and `teardown()`; `createSchema`/`seed` are unused.
- `:52` — `placeholders = values.map((_, i) => '?')` hard-codes `?` placeholders, which is
  wrong for Postgres (`$1`) and MSSQL (`@p1`).

## Why this is bad

- A test utility that produces invalid SQL is a latent trap: any consumer calling
  `createSchema` fails immediately; the bug is invisible because no one calls it.
- Name-based DDL contradicts the metadata-driven design of the ORM.
- `?`-only placeholders silently break for two of three supported dialects.
- Dead-but-exported API increases the public surface and confuses consumers about the
  intended setup path.

## Why this is bad (catch-block audit)

No catch blocks in this file; the issue is invalid SQL + dead API, not error swallowing.

## Target architecture

Apply **YAGNI** + **SRP**: either (a) reduce `DatabaseHarness` to the connect/teardown
lifecycle that is actually used, delegating schema setup to migrations/metadata; or
(b) make `createSchema`/`seed` metadata-driven and dialect-aware. Prefer (a) unless a
concrete consumer needs metadata-driven seeding, in which case fold it into the contract
harness (task-1) rather than a parallel utility.

## Proposed refactor

1. If keeping: fix `CREATE TABLE IF NOT EXISTS`, drive columns from `MetadataStorage`, and
   obtain placeholder style from the provider's dialect.
2. If trimming: remove `createSchema`/`seed`/`dropSchema` and keep only
   `setup`/`teardown`; update the barrel.
3. Either way, unify the `DatabaseProvider` type per testkits/task-3.

## Suggested design patterns

- **Adapter** — obtain placeholder style + DDL from the dialect rather than hard-coding.
  WHY: removes dialect-incorrect SQL.
- **Composition over a parallel utility** — fold any kept seeding into the contract harness.
  WHY: one setup path, not two.

## Testing plan

- If kept: unit tests asserting valid `CREATE TABLE IF NOT EXISTS` and correct placeholders
  per dialect, plus metadata-driven column emission.
- If trimmed: update `DatabaseHarness.test.ts` to the reduced surface.

## Acceptance criteria

- [ ] No invalid `CREATE TABLE IF EXISTS` remains.
- [ ] Schema/DML (if retained) is metadata-driven and dialect-aware (correct placeholders).
- [ ] Public API reflects only what is used/intended.
- [ ] `DatabaseHarness.test.ts` matches the final surface.

## Refactor order

1. Decide keep vs trim.
2. Apply the chosen change.
3. Update tests + barrel.

## Notes

- e2e `setup.ts` only needs lifecycle; trimming is the low-risk default.
