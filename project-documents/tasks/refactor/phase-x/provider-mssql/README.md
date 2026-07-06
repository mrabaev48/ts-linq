# Refactor Audit: provider-mssql

## Package responsibility
`@ts-linq/provider-mssql` adapts the ts-linq ORM to Microsoft SQL Server via the `mssql` driver.
It owns: connection-pool lifecycle, health checks, DDL (create table/index), CRUD + upsert
(`MERGE`), transaction + savepoint management, parameter style mapping (`?` → `@p1..@pn`), entity
row materialization, value coercion (HierarchyId/spatial/JSON), Hi-Lo sequence reservation, and
SQL Server error/transient-error translation. Public surface: `MssqlProvider`, `buildMssqlConnectionString`,
`mapTypeToMssql`, hierarchy-codec, spatial-codec (re-exported via `src/index.ts`).

## Current architectural problems
- **God class.** `MssqlProvider.ts` is 679 LOC mixing 8+ responsibilities on the query hot path (task-1).
- **Triplicated private helpers.** `mapRowToEntity`/`coerceToSqlParameter` are copy-pasted across all three providers and already drifting; MSSQL alone coerces `undefined→null` (task-2). Note: the silent `String()` coercion fallback was already removed from all three (coercion fail-fast sweep) — task-2 is now pure consolidation into a shared collaborator, not a behavior change.
- **Bespoke error mapping.** `mapMssqlError` keys on numeric `number` and silently drops the driver code, unlike PG/MySQL (task-3).
- **Implicit capability model.** Unlike PG/MySQL it casts the dialect and assumes `buildInsert` exists rather than guarding (task-4).
- **Raw `MERGE` SQL in the provider** with unquoted identifiers (task-5).
- **Untestable execution paths.** Driver is hard-required; unit tests cover only the constructor (task-6, task-7).
- **Silent catch blocks** in disconnect (pool close) and rollback paths (task-8).
- **Identifier-injection surface** in savepoint/sequence names and a **dead connection string** that diverges from the real connect path (task-9).

## Refactor goals
1. Make execution paths unit-testable via driver dependency inversion (Ports & Adapters).
2. Collapse cross-provider duplication into shared collaborators (mapper, coercer, error registry).
3. Shrink the provider to a thin orchestrating facade over single-responsibility collaborators.
4. Replace implicit feature probing with an explicit capability model and typed errors.
5. Eliminate silent error swallowing and identifier-injection surfaces.

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-7 (driver DI / Ports & Adapters) | P0 | Foundation: unlocks all unit testing; also fixes PG broken-import bug |
| 2 | task-6 (contract test suite) | P1 | Safety net before any decomposition |
| 3 | task-3 (error registry) | P1 | Low-risk, independent; fixes dropped-code bug |
| 4 | task-2 (shared mapper/coercer → new `provider-kit`) | P1 | Removes triplication + `undefined` drift; introduces `@ts-linq/provider-kit` (delegates coercion tail to `dialect-kit`) |
| 5 | task-4 (capabilities model) | P1 | Removes hidden feature gaps before split |
| 6 | task-1 (god-class decomposition) | P0 | Main structural fix; depends on 1–5 |
| 7 | task-5 (MERGE → dialect) | P2 | Moves SQL gen to correct layer |
| 8 | task-8 (silent catches) | P1 | Observability; needs fake driver from task-7 |
| 9 | task-9 (identifier safety + conn-string) | P2 | Folds partly into task-1 |

## Dependencies on other packages
- `@ts-linq/core` (`DatabaseProvider` base, `SqlHelper`, geometry guards) — the error registry (task-3) may land here; the mapper/coercer (task-2) land in the **new `@ts-linq/provider-kit`**, not `core` (so the `ValueCoercer` tail can reuse `@ts-linq/dialect-kit` `coerceSqlParameter`; `core` must not depend on `dialect-kit`).
- `@ts-linq/dialect-mssql` (DDL + SQL generation) — receives `buildUpsert` (task-5).
- `@ts-linq/metadata` (`MetadataStorage`), `@ts-linq/types` (config + error classes + new capability/error types).
- `@ts-linq/metrics-safe` — correct logging target referenced incorrectly by the PG sibling (task-7).

## Testing strategy
- Unit (offline, fake driver): collaborators + contract suite covering CRUD, transaction state machine, savepoints, error mapping, sequences, failure-path logging.
- Dialect snapshot tests for the moved upsert SQL.
- Container-backed `tests/mssql.*` retained as integration coverage, not the primary gate.

## Notes
This package hosts the four cross-cutting tasks (task-2 mapper/coercer, task-3 error registry,
task-4 capabilities, task-5 upsert, task-6 contract, task-7 driver DI) because its variants are
the most divergent/highest-risk. Mirror tasks exist under provider-mysql and provider-postgres
with `related:` links.
