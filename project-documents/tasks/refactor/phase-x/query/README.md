# Refactor Audit: query

## Package responsibility
`@ts-linq/query` is the chainable query surface (LINQ/EF-Core-style). It accumulates query
intent into a `QueryModel`, compiles it to SQL via `QueryBuilder` (delegating dialect syntax
to `SqlDialect`), executes it via `QueryExecutor` (primary + fallback + hedged paths),
materializes rows via `RowMaterializer`, plans eager includes via `IncludePlanner`, and
applies global query filters, tracking, caching and pagination. The public entrypoint is
`Queryable<T>` / `OrderedQueryable<T>` / `TypedQueryable<T>`.

## Current architectural problems
- **`Queryable<T>` is a 1812-LOC god class** owning ~10 distinct responsibilities, with ~25
  fields and an 11-arg constructor duplicated across 4 call sites (task-1, task-3).
- **Inconsistent immutability**: 23 mutating `return this` vs 18 cloning operators →
  shared-mutable-state aliasing bug when forking a base query (task-2).
- **The entire `SqlVisitorOptions` surface is dead in the `.where()/.having()` path**: every
  production site is a bare `new SqlVisitor()`, so value converters are silently ignored
  (wrong results) and spatial/JSON/complex/EF.functions predicates throw (task-4).
- **Raw, ANSI-hardcoded SQL assembly inside the dialect-agnostic query package** (`ofType`,
  `_addJoinOn`, `whereInSubquery`) — breaks on MySQL and violates the package boundary
  (task-6).
- **Selector lambda types over-promise**: `(e:T)=>T[keyof T]` accepts nested paths that
  throw at runtime; `thenInclude` typed `never` (task-5).
- **Compilation and caching are entangled** in `QueryBuilder`; count SQL is reshaped inside
  `QueryExecutor` with private-field casts; deprecated no-op statics linger (task-7).
- **Silent catch swallowing a global query filter** that fails to compile — a data-leak risk
  (task-8); inline include `Proxy` double-invokes the user lambda on error (task-9).
- **Loose public barrel** (`export *`) freezes internals as public contract (task-10).

## Refactor goals
1. Reduce `Queryable` to a thin, immutable facade over focused collaborators.
2. Make immutability uniform and the construction contract a single value object.
3. Wire the full SQL-visitor feature set into the runtime predicate path (correctness).
4. Push all SQL syntax to the dialect; keep the query package dialect-agnostic.
5. Separate compilation from execution and from caching (decorator).
6. Make selector types honest; fail-closed on filter-compilation errors.
7. Curate the public API surface.

## Recommended task order
| Order | Task | Priority | Status | Reason |
|---:|---|---|---|---|
| 1 | task-4 | P0 | ✅ Completed | Correctness: converters silently ignored, features throw in `.where()`. |
| 2 | task-8 | P0 | ✅ Completed | Security/correctness: silent global-filter drop can leak rows. |
| 3 | task-6 | P0 | ✅ Completed | Cross-dialect SQL bug + boundary violation (hardcoded `"`). |
| 4 | task-3 | P1 | ✅ Completed | QueryContext value object; also fixes `selectCompiled` config loss. |
| 5 | task-2 | P0 | ✅ Completed | Uniform immutability; unblocks safe decomposition. |
| 6 | task-1 | P0 | ✅ Completed | Decompose the god class into 10 focused collaborators (facade). |
| 7 | task-7 | P1 | ✅ Completed | Split compile/execute/cache (decorator). |
| 8 | task-5 | P1 | ✅ Completed | Honest selector types + type-level tests. |
| 9 | task-9 | P2 | ✅ Completed | Extract include proxy into `IncludeSelectorResolver` (Result type); single invocation. |
| 10 | task-10 | P2 | ✅ Completed | Public API/barrel hygiene: explicit named exports; `QueryBuilder`/`LruCache` → `/internal` (major bump). |

> **Package status: ✅ done** — all tasks 1–10 complete (task-4, task-8, task-6, task-3, task-2, task-1, task-7, task-5, task-9, task-10).
> Note: task-1's `IncludeBuilder` already extracted the filtered-include `Proxy`; task-9 formalized it into a named `IncludeSelectorResolver` returning a discriminated `IncludeResolution` (`subquery | error`), invoked exactly once, and removed the dead `extractKey` fallback / useless catch.

## Dependencies on other packages
- `@ts-linq/sql-visitor` — predicate→SQL fragment generation (task-4 wiring, sql-visitor
  task-1 translator injection).
- `@ts-linq/ast` — `ExpressionNode` AST consumed by `whereCompiled`/`havingCompiled`.
- `@ts-linq/types` — `QueryModel` clause shapes, `SqlDialect`, performance/fallback options;
  task-6 may extend `JoinClause`.
- `@ts-linq/core` — `DatabaseProvider`, `EntityLoader` (execution + includes).
- `@ts-linq/metadata` — `MetadataStorage` for column/relationship resolution.
- `@ts-linq/metrics-safe` — cache/metrics telemetry.
- Dialect packages (`dialect-postgres/mysql/mssql`) — quoting + `?`→placeholder rewrite;
  task-6 moves more rendering here.

## Testing strategy
- Preserve `tests-new/Queryable.test.ts` as the behavioral contract throughout.
- Add **fork-safety** regression tests (immutability), **converter-in-WHERE** integration
  tests (task-4), **cross-dialect quoting** contract tests (task-6), **error-path** tests
  for filter-compilation and fallback exhaustion (task-8), **type-level** selector tests
  (task-5), and an **export snapshot** (task-10).

## Notes
task-4 and task-8 are the two findings most likely to be production-visible bugs (silent
wrong results / data leak) and should be prioritized over the structural decomposition.
Several tasks are breaking → coordinate a single `major` changeset where possible.

**Follow-up (tracked in `core/task-10`, P3, optional):** `SetPropertyCalls`'s literal coercion tail
is a duplicate of `SqlHelper.ensureSqlParameter`'s. Both were made fail-fast in-place (coercion
sweep); their optional de-duplication into a single `@ts-linq/core` helper is filed under
`core/task-10` (anchored in `core` because the shared helper lives there and `query → core` already
holds). Not a `query`-package task.
