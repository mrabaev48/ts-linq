# refactor query/task-6: move raw SQL out of Queryable into the dialect

✅ DONE (query's THIRD refactor task; after task-4, task-8). Branch
`audit-refactor/query-move-sql-to-dialect`.

## What changed
- **Hardcoded ANSI `"` gone from `Queryable.ts`.** `ofType` (TPH/TPT) and `_addJoinOn` no longer
  hand-build quoted SQL; quoting is now the dialect's job (fixes MySQL backticks / MSSQL brackets).
  Grep gate `grep -n '"\${' packages/query/src/Queryable.ts` → no matches.
- **`whereInSubquery` correctness fix** (standalone): resolves the property key via
  `resolveColumnName` and quotes via `this._provider.getDialect().quoteIdentifier(...)` before
  emitting `<col> IN (<subquery>)` — fixes wrong-column bug under `@Column({ name })`.
- **Structured JoinClause model** (`@ts-linq/types/src/sql.ts`): added `JoinColumnRef`
  `{ table; column }` (unquoted) and `JoinOnCondition { left; right }`; `JoinClause` gained
  `onColumns?: readonly JoinOnCondition[]` and made `on` **optional + @deprecated** (kept as
  backward-compat fallback). Barrel is `export *` so no index edit.
- **Shared renderer**: new public `renderJoinOn(join, quoteIdentifier)` in
  `@ts-linq/sql-visitor` (`src/render-join.ts`, exported from barrel). Prefers `onColumns`
  (each id quoted, conditions joined by ` AND `), falls back to `on`. Dialects already depend on
  sql-visitor → no boundary break. Avoids 3× duplication (no shared base dialect exists yet).
- **3 dialect JoinEmitters** (`PgJoinEmitter`/`MySqlJoinEmitter`/`MssqlJoinEmitter`) now take a
  `quoteIdentifier` ctor arg and call `renderJoinOn`. Wired in each Dialect via
  `new PgJoinEmitter((id) => this.quoteIdentifier(id))` (field initializer; method is on prototype
  so `this.quoteIdentifier` is safe). Table-name quoting left inline as before (unchanged).
- **FragmentJoinPlanner** (sql-visitor, entity-splitting fragment joins) migrated to emit
  `onColumns` instead of hardcoded-`"` `on` string — same MySQL bug, closed here too (user asked
  to include it in scope).
- **QueryBuilder.serializeJoins** (cache key) now serializes `onColumns` (fallback to `on`).
- **Subquery param-ordering fix**: `whereExists`/`whereInSubquery` had a latent bug — the spliced
  subquery is rendered by its own dialect pass, so for PG/MSSQL it arrives pre-numbered (`$1`/`@p1`)
  and the outer global `?`→`$N` renumber would collide with outer params. Fix: new private
  `normalizeSplicedSubquerySql(sql)` resets `@p\d+|\$\d+` → `?` so the single outer renumber aligns
  everything (safe: values are always parameterized, never inlined). MySQL was already fine.

## Tests
- Per-dialect contract `it('renders structured onColumns with … quoting')` added to each
  `*Dialect.test.ts` — asserts `"` (PG), backtick (MySQL), `[ ]` (MSSQL).
- New `packages/query/tests-new/SubquerySplice.test.ts` with a `RenumberingDialect` (renders WHERE
  + global `?`→`$N`): whereInSubquery resolves+quotes column; param ordering aligned for
  whereInSubquery AND whereExists (would FAIL without the normalize fix → proves the bug existed).
- Updated existing `.on`-string assertions → `onColumns` in `Queryable.test.ts`,
  `of-type.test.ts` (also added `quoteIdentifier` to its mock dialect), `FragmentJoinPlanner.test.ts`.
- Updated sql-visitor public-barrel snapshot (`tests/index.test.ts`) to include `renderJoinOn`.

## Versioning
types 4.4.0 minor, sql-visitor 4.3.0 minor (new public renderJoinOn), dialect-postgres/mysql/mssql
2.8.0 minor each, query 2.4.37 patch. `on?` optionality classified minor (task author pre-blessed
"minor additive"; `.on` semantics unchanged when present). Changeset consumed; downstream internal
deps auto-bumped patch.

## Validation
typecheck ✅, lint ✅ (only pre-existing warnings), test:unit ✅ (3207 pass), build ✅,
arch:deps ✅, arch:cycles ✅, arch:dead ✅. **Integration/e2e NOT run here** — they spin
docker-compose.test.yml (pg:6543/mysql:3306/mssql:1433) and per standing feedback hang / are run
manually by the user. Must be run locally before merge.

## Coordination / tech debt
- Structured `JoinClause` feeds `query/task-1` (JoinBuilder/InheritanceQueryPlanner extraction).
- `JoinClause.on` string fallback retained for back-compat → removal target (future major).
- No shared base dialect yet — onColumns rendering is per-emitter via the shared `renderJoinOn`
  helper; full base-dialect consolidation remains `dialect-*/task-1`.
- Next query task per order = task-3 (then 2, 1, 7, 5, 9, 10).
