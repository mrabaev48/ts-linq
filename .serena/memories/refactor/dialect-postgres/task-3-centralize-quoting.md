# dialect-postgres task-3 — Centralize identifier/literal quoting (P0, security) ✅ COMPLETED

Branch: `audit-refactor/dialect-centralize-quoting` (from main @ 1acfbbb5).
Cross-dialect fix touching **dialect-postgres, dialect-mysql, dialect-mssql** (all bumped 2.8.5, patch).

## What was wrong
Each dialect had a correct, escaping `quoteIdentifier`, but its own DML/DDL/batch/index builders
never used it — hardcoded the quote char inline (no escaping) or omitted quoting entirely
(MSSQL/MySQL CRUD). MSSQL DDL interpolated the raw table name into T-SQL **string literals**
(`sys.tables` lookup, `sp_rename`, `sp_addextendedproperty`, `sys.indexes`/`OBJECT_ID`) with no
`'`-escaping → literal-injection vector (db-first scaffolding surfaces arbitrary DB identifiers).

## Architecture of the fix (SSOT / Facade)
New per-package module **`src/quoting.ts`** exporting two pure functions:
- `quoteIdentifier(s)` — body moved verbatim from the dialect (`"`→`""` PG, `` ` ``→`` `` `` MySQL,
  `]`→`]]` MSSQL).
- `quoteStringLiteral(s)` — NEW: `'`→`''`, wraps in `'...'`.

`XxxDialect.ts`: `quoteIdentifier` now delegates to `quoting.ts`; added public `quoteStringLiteral`
method (delegates). NOT added to `SqlDialect` interface in `@ts-linq/types` — internal package helper,
no public-contract/types change, 0 breaking changes.

`batch-syntax.ts`, `*DdlStrategy.ts`, `builders/*IndexBuilder.ts`, and the three `*JoinEmitter.ts`
import `quoteIdentifier`/`quoteStringLiteral` directly from `./quoting` (no Dialect-instance
injection — minimal blast radius). Injection via task-1 `DialectSyntax` is deliberately deferred
(tech debt).

## Files changed (per dialect, all three)
- `src/quoting.ts` (new)
- `src/XxxDialect.ts` — delegate + `quoteStringLiteral` method; all CRUD (buildInsert/Update/Delete/
  BulkUpdate/BulkDelete) + `buildFromClause`/`buildSelect FROM` routed through `quoteIdentifier`.
- `src/batch-syntax.ts` — all insert/update/delete builders.
- `src/XxxDdlStrategy.ts` — create table / add-drop-alter column / rename / FK / unique / comment.
  Comments: inline `.replace(/'/g,"''")` replaced by `quoteStringLiteral`.
- `src/builders/XxxIndexBuilder.ts`.
- `src/emitters/XxxJoinEmitter.ts` — line-15 hardcoded `"${join.table}"` (SELECT path) routed
  through the already-injected `this.quoteIdentifier` (golden-safe).
- **MSSQL literal positions** (highest risk): `MssqlDdlStrategy.ts:32` (`sys.tables WHERE name=…`),
  `:104` (`sp_rename …,…`), `:157/163` (`sp_addextendedproperty N…`, kept `N` prefix); and
  `MssqlIndexBuilder.ts:38` (`sys.indexes WHERE name=…`, `OBJECT_ID(…)`) → `quoteStringLiteral`.

## Deliberately OUT of scope (documented tech debt)
- `json/JsonPathTranslator.ts` in all three still hardcodes `"${node.column}"` etc. — query/expression
  path, dialect-divergent JSON syntax (PG `->`, MySQL `JSON_EXTRACT`, MSSQL `JSON_VALUE`), own test
  contracts. Same vuln class; separate follow-up.
- Quoter injection via `DialectSyntax` (task-1) — this task routes through the existing helper as interim.

## Cross-links (partially satisfies)
`dialect-mssql/task-2` and `dialect-mysql/task-2` both list "central quoting / DDL interpolation /
unquoted CRUD" — the CRUD+DDL+batch+index quoting portion is now DONE by this cross-dialect fix.
Their remaining scope (shared-base extraction, capability model) is untouched → keep them not-started.

## Tests
- Golden snapshots (task-6 contract harness): MSSQL + MySQL `insert/update/delete` updated to the
  now-quoted output (`[users]([name])` / `` `users`(`name`) ``). PG golden unchanged (already visually
  identical for simple names). Header comments document the change as the intended security fix.
- New adversarial `describe('adversarial identifiers (task-3)')` blocks in each `*Dialect.test.ts`
  (col with dialect quote char + table breakout) and `quoteStringLiteral` unit tests.
- MSSQL `MssqlDdlStrategy.test.ts`: new `literal-injection defense` block — `o'brien` table →
  `'o''brien'` doubled in sys.tables/sp_rename/sp_addextendedproperty/sys.indexes; also fixed 2
  pre-existing index assertions (`ON [users]`, `[name] DESC`).
- Total dialect tests: 343 pass (was 327). Full `pnpm test:unit`: 3868 pass — no downstream breakage.

## Validation outcomes
typecheck ✓ · lint ✓ (0 errors, only pre-existing complexity/line-count warnings) · test:unit ✓ 3868 ·
build ✓ · arch:deps ✓ · arch:cycles ✓ (no cycles) · arch:dead ✓ (quoting exports all used).
integration/e2e NOT run in-session (known-hang per user standing instruction; change is SQL-string-gen
only, fully unit-covered).

## Acceptance-grep (task-3 Step 3.5)
`grep '\[${|"${|`${|${metadata.tableName}|${tableName}' dialect-*/src` over DML/DDL/batch/index builders,
excluding `quoteIdentifier|quoteStringLiteral|throw|logger|warn` → CLEAN (0 bypasses).

## Changeset
`.changeset/dialect-centralize-quoting.md` → patch × {dialect-postgres, dialect-mysql, dialect-mssql},
security note. Consumed via `pnpm changeset version` (all three → 2.8.5; dependents cli/provider-*/
testkits internal-patch bumped).
