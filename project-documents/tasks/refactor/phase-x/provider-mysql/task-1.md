---
status: not-started
phase: phase-x
package: provider-mysql
priority: P0
effort: XL
risk: high
category: architecture
depends_on: []
related: ["provider-mssql/task-1.md", "provider-postgres/task-1.md"]
---

# Refactor: Decompose `MySqlProvider` god class into focused collaborators

## Problem
`MySqlProvider` (532 LOC) conflates driver loading, pool lifecycle, health checks, DDL, CRUD,
raw `ON DUPLICATE KEY UPDATE` upsert SQL, a bespoke `executeInsert` that re-implements the
execute pipeline, transaction + savepoint management, entity mapping, value coercion, MySQL Hi-Lo
emulation, and error/transient translation — all in one class on the query hot path.

## Evidence
- `packages/provider-mysql/src/MySqlProvider.ts:70` — class declaration.
- Driver + pool: `safeRequireMysql2 :60`, `doConnect :91-127`, `doDisconnect :129-136`.
- DDL: `createTable :138-149`.
- CRUD: `insert :151`, `update :190`, `upsert :224`, `delete :248`, `findById :272`, `findAll :297`, `findWhere :309`, `findWhereIn :334`.
- Bespoke execute path: `executeInsert :165-181` re-implements `connect`/`beforeExecute`/`afterExecute` outside `doExecuteNonQuery` (see task-8).
- Raw upsert SQL: `upsert :242-243` builds `ON DUPLICATE KEY UPDATE` by string concat with **unquoted** column names.
- Transaction/savepoint: `doBeginTransaction :414`, `doCommitTransaction :421`, `doRollbackTransaction :428`, savepoints `:438-454`.
- Mapping/coercion: `mapRowToEntity :513`, `coerceToSqlParameter :492`. Error map: `mapMySqlError :50`.

## Why this is bad
- SRP violation: many reasons to change in one class; hot-path code interleaved with setup.
- The duplicated structure across providers multiplies maintenance cost (see related tasks).
- `executeInsert` forks the execution pipeline, so insert observability/error handling diverges from every other statement.

## Target architecture
Thin **Facade** delegating to injected collaborators (Clean Architecture, composition-first):
`MySqlConnectionManager`, `ProviderCrudExecutor` (shared, task-2), `MySqlUpsertWriter` (dialect-owned, task-5),
`MySqlTransactionManager`, shared `EntityMapper`/`ValueCoercer` (task-2), shared `ErrorTranslator` (task-3),
driver behind a port (task-7). SOLID: SRP per collaborator, DIP via ports, OCP via strategies.

## Proposed refactor
1. Extract connection + transaction managers.
2. Fold `executeInsert` back into the unified execute pipeline (task-8) so insert uses the same hooks/error mapping; obtain `insertId` from the standard result.
3. Move mapping/coercion/error mapping to shared collaborators (task-2, task-3).
4. Reduce `MySqlProvider` to construction + delegation; keep the `DatabaseProvider` contract identical.

## Suggested design patterns
- **Facade**, **Strategy** (coercion/error/upsert), **Template Method** (keep `do*` hooks delegating), **Composition over inheritance**.

## Testing plan
- Unit: collaborators with a fake driver (task-7) — connection, transaction state, savepoint SQL, insertId readback.
- Contract: shared suite (task-6).
- Regression: `tests/mysql.crud.test.ts` + snapshots unchanged.
- Error-path: forced driver errors map via the registry.

## Acceptance criteria
- [ ] `MySqlProvider` under ~200 LOC, construction + delegation only.
- [ ] `executeInsert` no longer forks the execute pipeline.
- [ ] Mapping/coercion/error mapping live in shared units.
- [ ] Public API + behavior unchanged.
- [ ] Unit tests cover each collaborator with a fake driver.
- [ ] `pnpm typecheck`/`lint`/`tests:unit`/`build`/`arch:cycles` pass.

## Refactor order
After task-7 (driver DI), task-2/task-3, then decompose.

## Notes
Mirrors `provider-mssql/task-1.md`. Use the identical collaborator shape across all three.
