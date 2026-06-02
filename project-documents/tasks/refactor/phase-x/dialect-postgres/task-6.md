---
status: not-started
phase: phase-x
package: dialect-postgres
priority: P1
effort: L
risk: medium
category: testing
depends_on: []
related: ['dialect-postgres/task-1.md', 'dialect-postgres/task-7.md', 'dialect-mssql/task-1.md', 'dialect-mysql/task-1.md']
---

# Refactor: Add a shared dialect contract-test harness verifying all dialects implement SqlDialect consistently

## Problem
There is no shared test suite that asserts every dialect honors the `SqlDialect` contract uniformly. Each
package owns parallel, hand-written, copy-pasted tests (`*Dialect.test.ts`, `*BatchSyntax.test.ts`,
`build-update-concurrency.test.ts`) that test each dialect in isolation. Nothing guarantees that, given the
same `QueryOptions`/`EntityMetadata`, the three dialects produce structurally equivalent, correct SQL — so
divergences (e.g. the MSSQL GROUP-BY guard, the computed-column INSERT difference) ship undetected.

## Evidence
- Parallel per-dialect test trees with no shared driver:
  - `packages/dialect-mssql/tests-new/dialect/MssqlDialect.test.ts`,
    `packages/dialect-mysql/tests-new/dialect/MysqlDialect.test.ts`,
    `packages/dialect-postgres/tests-new/dialect/PostgresDialect.test.ts`.
  - `packages/dialect-*/tests-new/*BatchSyntax.test.ts` (three near-identical copies).
  - `packages/dialect-*/tests-new/build-update-concurrency.test.ts` (three copies).
- Real divergences that a contract suite would have caught:
  - GROUP-BY empty-columns guard exists only in MSSQL (`packages/dialect-mssql/src/emitters/MssqlGroupEmitter.ts:10`).
  - INSERT excludes `isComputed` in MySQL/PG but not MSSQL (`packages/dialect-mysql/src/MysqlDialect.ts:132`
    vs `packages/dialect-mssql/src/MssqlDialect.ts:143`).
  - MSSQL provider lacks the CRUD presence guards the others have (`packages/provider-mssql/src/MssqlProvider.ts:205`).

## Why this is bad
- No safety net for the duplication tasks (`task-1`..`task-5`): refactors could silently change one dialect's
  output. The contract suite is the precondition that makes those refactors safe.
- Behavioral parity is asserted nowhere; correctness drift is invisible until production.
- Testing the same logic three times is itself duplication and maintenance drag.

## Target architecture
A **parameterized contract test** (one suite, many implementations) under Clean Architecture testing
principles — depend on the `SqlDialect` abstraction, not concretes:
- A shared `runSqlDialectContract(makeDialect, expectations)` harness exercising a representative
  `QueryOptions`/`EntityMetadata` matrix: SELECT (distinct/limit/offset/join/group/having/order),
  INSERT/UPDATE/DELETE (with version + concurrency tokens), bulk update/delete, batch insert/update/delete.
- Per-dialect "golden" expectations supplied as data (snapshots), so the *structure* is shared and only the
  dialect-specific tokens differ.
- Assertions on: clause ordering, parameter count/order, placeholder style, identifier quoting,
  declared `capabilities` matching implemented methods (ties to `task-2`).

## Proposed refactor
1. Decide host: place the harness in `@ts-linq/testkits` (already a cross-package test utility package) to
   avoid a dialect package depending on its siblings; each dialect's test imports the harness.
2. Implement `runSqlDialectContract`; feed it `() => new PostgresDialect()` etc.
3. Replace the three copies of `BatchSyntax`/`build-update-concurrency` tests with the shared matrix + golden files.

## Suggested design patterns
- **Parameterized / Contract test (Liskov-style substitutability check)**. WHY: proves every dialect is a valid
  `SqlDialect` substitute; one suite, N implementations.
- **Golden master / snapshot** per dialect. WHY: locks exact SQL while sharing the test structure.

## Testing plan
- The harness IS the testing deliverable. Validate it catches injected regressions (mutation check: flip the
  MSSQL GROUP guard and confirm the contract fails).
- Keep golden files in-repo; review diffs on dialect changes.

## Acceptance criteria
- [ ] `runSqlDialectContract` harness exists in `@ts-linq/testkits` (no dialect→dialect dependency).
- [ ] All three dialects run the shared contract; golden expectations checked in.
- [ ] The three copied `BatchSyntax`/`concurrency` tests are replaced by the shared matrix.
- [ ] A deliberately injected divergence fails the contract (verified once).
- [ ] `pnpm tests:unit` green; `pnpm arch:cycles` clean.

## Refactor order
1. Build harness against current dialects (documents existing behavior). 2. Land before `task-1` so the base-dialect refactor is guarded. 3. Extend with `capabilities` assertions after `task-2`.

## Notes
Cross-package: the harness belongs in `@ts-linq/testkits` precisely so no dialect package imports a sibling
dialect (which would create a forbidden cross-boundary dependency).
