# Refactor Audit: provider-mysql

## Package responsibility
`@ts-linq/provider-mysql` adapts the ts-linq ORM to MySQL via `mysql2/promise`. It owns: pool
lifecycle, health checks, DDL, CRUD + `ON DUPLICATE KEY UPDATE` upsert, transaction + savepoint
management, positional `?` parameters, entity materialization, value coercion (WKB spatial),
MySQL Hi-Lo counter-table emulation, and MySQL error/transient translation. Public surface:
`MySqlProvider`, `buildMysqlConnectionString`, spatial-codec (re-exported via `src/index.ts`).

## Current architectural problems
- **God class.** `MySqlProvider.ts` is 532 LOC across many responsibilities (task-1).
- **Forked insert pipeline + unpinned pool transactions.** `executeInsert` duplicates the execute pipeline, and transactions run on the pool rather than a pinned connection — a silent isolation bug (task-8). This is the most severe MySQL-specific finding.
- **Triplicated mapper/coercer**, with the coercer bypassed in `upsert` (task-2). Note: the silent `String()` coercion fallback was already removed (coercion fail-fast sweep) — task-2 is pure consolidation into `@ts-linq/provider-kit`, delegating the tail to `dialect-kit`.
- **Bespoke error mapping** split across `code` (mapping) and `errno` (transience) (task-3).
- **Implicit capability probing** via `if (!dialect.buildX) throw` (task-4).
- **Raw, unquoted upsert SQL** in the provider (task-5).
- **Untestable execution paths**; constructor-only unit tests (task-6, task-7).

## Refactor goals
1. Fix the transaction-connection-pinning correctness bug and unify the insert pipeline.
2. Invert the driver dependency to enable offline unit tests.
3. Collapse cross-provider duplication into shared collaborators.
4. Shrink the provider to a delegating facade with explicit capabilities.
5. Move upsert SQL into the dialect with quoted identifiers.

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-7 (driver DI) | P0 | Enables all unit testing; depends on the MSSQL anchor |
| 2 | task-6 (contract suite) | P1 | Safety net before structural change |
| 3 | task-8 (pinned tx + remove executeInsert) | P1 | Fixes a real isolation bug + pipeline drift |
| 4 | task-3 (error registry) | P1 | Independent; unifies code/errno split |
| 5 | task-2 (shared mapper/coercer → `provider-kit`) | P1 | Removes triplication + upsert coercion bypass; adopts `@ts-linq/provider-kit` (coercion tail delegated to `dialect-kit`) |
| 6 | task-4 (capabilities) | P1 | Removes hidden feature gaps |
| 7 | task-1 (god-class decomposition) | P0 | Main structural fix; absorbs tx pinning |
| 8 | task-5 (upsert → dialect) | P2 | Correct layer + quoting |

## Dependencies on other packages
- `@ts-linq/core` (`DatabaseProvider`, `SqlHelper`, geometry guards), `@ts-linq/dialect-mysql`
  (DDL, `buildMysqlNextBlockSql`, receives `buildUpsert` in task-5), `@ts-linq/metadata`,
  `@ts-linq/types` (config/errors + new capability/error types).
- Shared collaborators (mapper/coercer/error registry/capabilities) are defined under
  provider-mssql tasks and consumed here. The mapper/coercer live in the **new `@ts-linq/provider-kit`**
  (its `ValueCoercer` tail reuses `@ts-linq/dialect-kit` `coerceSqlParameter`; `core` must not depend
  on `dialect-kit`).

## Testing strategy
- Unit (offline, fake driver): contract suite + MySQL cases (insertId, Hi-Lo, upsert, **connection pinning**).
- Dialect snapshot tests for the moved upsert SQL.
- Container-backed `tests/mysql.*` retained as integration coverage.

## Notes
The transaction-pinning bug (task-8) is the standout MySQL-specific risk and should not wait for
the full god-class split. Most other tasks are mirrors of the provider-mssql anchors via `depends_on`/`related`.
