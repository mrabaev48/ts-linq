---
status: not-started
phase: phase-x
package: dialect-postgres
priority: P2
effort: M
risk: low
category: clean-code
depends_on: []
related: ['dialect-postgres/task-1.md', 'dialect-mssql/task-1.md', 'dialect-mysql/task-1.md']
---

# Refactor: Remove dead duplicate clause methods in PostgresDialect and collapse the 12 per-dialect clause emitters into shared pure emitters

## Problem
`PostgresDialect` contains four private methods that re-implement WHERE/JOIN/GROUP/ORDER clause logic but are
never called — `buildSelect` uses the injected emitter objects instead. Separately, the four clause emitters
are copied across all three packages (12 classes total), byte-identical or differing only by quote character,
and have already drifted.

## Evidence
- Dead, never-called private methods in `packages/dialect-postgres/src/PostgresDialect.ts`:
  - `buildJoins` at `:137`, `buildWhereClause` at `:154`, `buildGroupByHaving` at `:163`, `buildOrderBy` at `:176`.
  - `buildSelect` (`:81-108`) calls `this.joinEmitter/whereEmitter/groupEmitter/orderEmitter`; grep shows zero
    call sites for the four privates → confirmed dead.
- WHERE emitters byte-identical: `packages/dialect-postgres/src/emitters/PgWhereEmitter.ts:3`,
  `packages/dialect-mssql/src/emitters/MssqlWhereEmitter.ts:3`,
  `packages/dialect-mysql/src/emitters/MySqlWhereEmitter.ts:3`.
- ORDER emitters byte-identical: `PgOrderEmitter.ts:3`, `MssqlOrderEmitter.ts:3`, `MySqlOrderEmitter.ts:3`.
- JOIN emitters differ only by quote char: `PgJoinEmitter.ts:8` (`"`), `MssqlJoinEmitter.ts:8` (`[]`),
  `MySqlJoinEmitter.ts:8` (`` ` ``).
- GROUP emitters drifted: MySQL/PG (`MySqlGroupEmitter.ts:9`, `PgGroupEmitter.ts:9`) lack the empty-columns
  guard that MSSQL has (`MssqlGroupEmitter.ts:10`) — produces a dangling ` GROUP BY ` on empty columns.

## Why this is bad
- Dead code misleads readers, inflates the class, ships in the bundle.
- 12 near-identical files multiply maintenance and have demonstrably drifted (the GROUP-BY guard) → latent bug.
- Violates DRY and SRP.

## Target architecture
- Delete the four dead methods from `PostgresDialect`.
- Replace the 12 emitter classes with four shared **pure functions** (`emitWhere`, `emitJoin(quote)`,
  `emitGroup`, `emitOrder`) parameterized by an injected `quote: (s: string) => string`, in the shared dialect
  kit (composition-first, stateless, single source of truth).
- Fold the correct MSSQL empty-columns guard into the single shared `emitGroup`.

## Proposed refactor
1. Remove `buildJoins/buildWhereClause/buildGroupByHaving/buildOrderBy` from `PostgresDialect.ts` (zero risk).
2. Add shared emitters; wire each dialect's `buildSelect` to them, passing its `quote`.
3. Delete the 12 per-dialect emitter files.

## Suggested design patterns
- **Pure function / Strategy injection** — emitters take `quote` rather than holding dialect state. WHY: one
  tested implementation, reusable, no inheritance.

## Testing plan
- Unit-test each shared emitter once with a stub `quote`, including the empty-GROUP-columns case.
- Regression: existing `*Dialect.test.ts` stay green.
- `pnpm arch:dead` reports no remaining dead emitter exports.

## Acceptance criteria
- [ ] Four dead methods removed from `PostgresDialect`.
- [ ] Twelve emitter files replaced by four shared pure emitters.
- [ ] Empty-GROUP-columns handled consistently (MSSQL guard becomes shared behavior).
- [ ] All dialect tests pass; `arch:dead`/`arch:cycles` clean.

## Refactor order
1. Delete PG dead methods. 2. Introduce shared emitters. 3. Migrate + delete per-dialect files.

## Notes
Prerequisite simplification for `task-1.md` (shared base dialect); shrinks its surface and removes a real
correctness drift (the GROUP-BY guard).
