# Refactor Audit: dialect-postgres

## Package responsibility
`@ts-linq/dialect-postgres` is the PostgreSQL implementation of the `SqlDialect` contract. It generates
SELECT/INSERT/UPDATE/DELETE and bulk/batch SQL, renders PostgreSQL identifier quoting (`"id"`) and `$N`
parameter markers, provides the DDL strategy (CREATE/ALTER/constraints, `mapTypeToPg`), JSON path translation
(JSONB operators), EF-function translations, ltree functions, spatial functions, DB-first introspection, and a
`maxBatchSize` options builder.

This package is also the designated host for the cluster-wide (cross-dialect) refactor tasks, because the three
dialect packages are near-identical and the shared abstractions must live in one place. Sibling stubs in
`dialect-mssql/` and `dialect-mysql/` cross-link here.

## Current architectural problems
- ~85% of the dialect class is duplicated across MSSQL/MySQL/Postgres; no base class or template method (task-1).
- Four dead duplicate clause methods in `PostgresDialect`; 12 near-identical emitter files cluster-wide (task-2).
- `quoteIdentifier` exists but is never used internally; CRUD/DDL hardcode or omit quoting; MSSQL DDL
  interpolates raw table names into string literals without escaping `'` (task-3, P0 safety).
- `SqlDialect` makes nearly every method optional, forcing scattered `if (!dialect.buildX) throw` runtime
  guards (MSSQL provider even omits them) instead of a typed capability model (task-2 [capability]).
- `coerce`/`applyConverter`/`insertableCols`/`numberPlaceholders` duplicated 6×, already drifting (computed-column
  INSERT divergence) (task-4).
- Silent `catch { return String(value) }` in parameter coercion corrupts data on serialization failure (task-5).
- No shared dialect contract-test harness; tests are parallel copies that miss divergences (task-6).
- DDL strategies have no shared interface and triplicate the type-mapping/column-def algorithm (task-7).
- Dead `chunk*Batch` exports, identical OptionsBuilders, and dialect→core/metadata coupling (task-8).
- A **second** DDL generator in `@ts-linq/migrations` (`ColumnHandlers`/`SqlUtils`) still duplicates
  type-mapping/quoting/`formatValue`, and `formatValue` now has copies in core + dialect-kit + migrations
  — follow-ups surfaced by task-7 (task-10, task-11, task-12).

## Refactor goals
- One shared base dialect (Template Method) + injected `DialectSyntax` (Strategy); concrete dialects become thin.
- One source of truth for quoting, coercion, column selection, type mapping, and DDL assembly.
- A typed capability model replacing optional-method sniffing.
- A parameterized contract test guaranteeing cross-dialect parity (the safety net for all dedup work).
- Correct, consistent SQL-injection-safe identifier/literal handling.

## Task index
- task-1 — Shared base SQL dialect (Template Method + `DialectSyntax`) — P1, architecture
- task-2 — Replace all-optional `SqlDialect` with an explicit capability model — P1, typescript
- task-3 — Centralize identifier quoting (DML & DDL) — P0, sql ✅ **completed**
- task-4 — Deduplicate coerce/applyConverter/insertableCols/numberPlaceholders — P1, clean-code ✅ **completed**
- task-5 — Replace silent `JSON.stringify` catch-and-swallow in coercion — P2, error-handling ✅ **completed**
- task-6 — Shared dialect contract-test harness — P1, testing ✅ **completed**
- task-7 — Shared `DdlStrategy` contract + extracted type-mapping — P1, architecture ✅ **completed**
- task-8 — Remove dead `chunk*Batch`, dedup OptionsBuilder, fix dialect→core/metadata coupling — P2, package-boundary
- task-9 — Remove PG dead clause methods + collapse 12 emitters into shared pure emitters — P2, clean-code ✅ **completed**
- task-10 — Converge the parallel `@ts-linq/migrations` DDL generator onto the shared `DdlStrategy` — P2, package-boundary _(tech debt from task-7)_
- task-11 — Complete the `formatValue` consolidation (remove core `SqlHelper.formatValue`, single dialect-kit SSOT) — P2, package-boundary _(tech debt from task-7)_
- task-12 — Inject the quoter into `AbstractDdlStrategy` (DDL quoting Strategy) — P3, clean-code _(tech debt from task-7)_

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-6 (contract harness) ✅ | P1 | Safety net before any dedup; documents current behavior |
| 2 | task-3 (centralize quoting) ✅ | P0 | Only safety/correctness defect; feeds task-1/task-7 |
| 3 | task-9 (PG dead code + shared emitters) ✅ | P2 | Low-risk simplification shrinking task-1's surface |
| 4 | task-4 (dedup coerce/columns) ✅ | P1 | Removes 6× duplication; resolves computed-col divergence |
| 5 | task-5 (typed coercion error) ✅ | P2 | Lands inside task-4's shared module |
| 6 | task-1 (shared base dialect) | P1 | The core dedup; guarded by task-6 |
| 7 | task-7 (shared DdlStrategy) ✅ | P1 | Mirrors task-1 for DDL; depends on task-3 |
| 8 | task-2 (capability model) | P1 | Typed contract replacing optional methods |
| 9 | task-8 (dead exports/options/coupling) | P2 | Cleanup; buildSelect metadata signature with task-1 |
| 10 | task-10 (converge migrations DDL) | P2 | Cross-boundary half of task-7's DDL dedup; pairs with migrations/task-3 |
| 11 | task-11 (formatValue SSOT) | P2 | Finishes task-7's dialect→core removal; a slice of task-8 |
| 12 | task-12 (inject DDL quoter) | P3 | Polish; unifies quoting injection with task-1's DialectSyntax |

## Dependencies on other packages
- `@ts-linq/types` (the `SqlDialect`/`EntityMetadata` contracts; capability + `DdlStrategy` interfaces land here).
- `@ts-linq/sql-visitor` (JSON path translator, SP call syntax, batch chunk helpers) — candidate host for shared base.
- `@ts-linq/core` (`SqlHelper`, `DatabaseProvider`) — current dialect→core coupling to be reduced (task-8).
- `@ts-linq/metadata` (`MetadataStorage`) — global lookup in `buildSelect` to be replaced by injection (task-8).
- Consumers: `@ts-linq/provider-postgres`, `@ts-linq/migrations`, scaffolding.
- Contract harness belongs in `@ts-linq/testkits` to avoid dialect→dialect dependencies.

## Testing strategy
- Build the contract harness first (task-6); keep existing `tests-new/**` green throughout as regression.
- Snapshot SQL output before/after every dedup task for byte-equality.
- Add type-level tests for the capability model and `requireCrud`-style assertion narrowing.
- Add adversarial-identifier tests (quote char, single quote) for task-3.

## Notes
All shared abstractions (`AbstractSqlDialect`, `DialectSyntax`, shared emitters, `coerceSqlParameter`,
`AbstractDdlStrategy`, `TypeMapper`) should live in one shared package — prefer a new `@ts-linq/dialect-kit`
to keep `@ts-linq/sql-visitor`'s surface narrow, or reuse `sql-visitor` if a new package is undesirable. The
decision must avoid any circular dependency (`arch:cycles`).

**Shared-home decision (resolved by task-9):** the new `@ts-linq/dialect-kit` package now hosts the shared
clause emitters (`emitWhere`/`emitJoin`/`emitGroup`/`emitOrder`). Dependency graph is
`dialect-* → dialect-kit → {sql-visitor, types}` — verified acyclic via `arch:cycles`. task-1's
`AbstractSqlDialect` and the other cluster-wide abstractions should build on this same package.
