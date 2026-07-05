# dialect-postgres task-9 — dead code + shared clause emitters ✅

**Status:** completed. Branch `audit-refactor/dialect-dead-code-shared-emitters`.

## What changed
1. **Removed 4 dead private methods** from `PostgresDialect.ts`: `buildJoins`,
   `buildWhereClause`, `buildGroupByHaving`, `buildOrderBy` (zero call sites — `buildSelect`
   always used the injected emitter objects). Also dropped the now-unused type imports
   `GroupByClause`/`OrderByClause`/`WhereClause` from PostgresDialect.
2. **New package `@ts-linq/dialect-kit`** (v0.1.0, private) hosts 4 shared **pure, stateless**
   clause emitters — single source of truth:
   - `emitWhere(parameters, options)`
   - `emitJoin(options, quote)`  ← identifier quoting injected (Strategy injection), uses
     `renderJoinOn` from sql-visitor
   - `emitGroup(parameters, options)`  ← **empty-columns guard folded in** (was MSSQL-only)
   - `emitOrder(options)`
   Exported from `src/index.ts`. Deps: `{@ts-linq/types, @ts-linq/sql-visitor}` only.
3. **Deleted 12 per-dialect emitter files** (`packages/dialect-{postgres,mysql,mssql}/src/emitters/`);
   the three dialects now import from `@ts-linq/dialect-kit` and call the functions in `buildSelect`,
   passing `(id) => this.quoteIdentifier(id)` to `emitJoin`.
4. Added `@ts-linq/dialect-kit` dep + tsconfig project reference to all three dialects; added
   jest-config `paths`/`moduleNameMapper` alias (`packages/jest-config/index.js`).

## Behavioural fix (GROUP BY drift)
Before: MSSQL guarded empty GROUP BY columns; **PG/MySQL emitted a dangling ` GROUP BY `** (latent
bug, visible in their contract goldens). Now the guard is shared → all three converge. Updated
PG/MySQL `dialect-contract.golden.ts` `group-empty` to `SELECT * FROM <table>` (no trailing GROUP
BY); MSSQL golden already correct. Updated the divergence comment in
`packages/testkits/src/dialect-contract/cases.ts`.

## Shared-home decision
New `@ts-linq/dialect-kit` chosen over reusing `sql-visitor` (keeps sql-visitor surface narrow;
natural home for task-1's `AbstractSqlDialect`). Graph `dialect-* → dialect-kit → {sql-visitor,
types}` — **acyclic** (confirmed by `arch:cycles`). Shrinks task-1's surface.

## Validation (all green)
typecheck ✅ · lint ✅ (0 errors) · unit 3882 ✅ (incl. new `dialect-kit/tests-new/emitters.test.ts`
+ 3 contract harnesses) · integration 461 ✅ · e2e 290 ✅ · build 33/33 ✅ · arch:deps ✅ ·
arch:cycles ✅ (no cycle) · arch:dead ✅ (no dead emitter exports / methods).

## Changesets
`@ts-linq/dialect-postgres`/`mysql`/`mssql` → patch (dedup + GROUP BY fix); new `@ts-linq/dialect-kit`
→ initial. All private packages.
