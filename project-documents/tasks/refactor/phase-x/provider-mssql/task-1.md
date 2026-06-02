---
status: not-started
phase: phase-x
package: provider-mssql
priority: P0
effort: XL
risk: high
category: architecture
depends_on: []
related: ["provider-mysql/task-1.md", "provider-postgres/task-1.md"]
---

# Refactor: Decompose `MssqlProvider` god class into focused collaborators

## Problem
`MssqlProvider` (679 LOC) is a single class that conflates almost every concern of the
data-access layer: driver loading, connection-pool lifecycle, health checks, DDL emission,
CRUD, raw `MERGE` SQL string assembly, transaction + savepoint management, parameter style
mapping, entity row materialization, value coercion, sequence reservation, error translation,
and transient-error classification. It is the execution hot path for every MSSQL query.

## Evidence
- `packages/provider-mssql/src/MssqlProvider.ts:72` — class declaration.
- Connection lifecycle + raw mssql config assembly: `doConnect` `:104-161`.
- DDL: `createTable` `:186-197`.
- CRUD: `insert :200`, `update :224`, `delete :259`, `upsert :285`, `findById :326`, `findAll :354`, `findWhere :367`, `findWhereIn :391`.
- Raw `MERGE` SQL hand-assembled inside the provider: `upsert :303-321`.
- Transaction/savepoint: `doBeginTransaction :494`, `doCommitTransaction :505`, `doRollbackTransaction :514`, `createSavepoint :532`, `rollbackToSavepoint :536`, `releaseSavepoint :541`.
- Entity mapping: `mapRowToEntity :575`. Value coercion: `coerceToSqlParameter :595`.
- Error mapping free function: `mapMssqlError :668`. Driver require: `safeRequireMssql :658`.

## Why this is bad
- Violates Single Responsibility Principle: 8+ distinct reasons to change in one class.
- Open/Closed violation: new value type or error mapping forces edits to the god class.
- Hot-path query execution is interleaved with rarely-changing setup code → high regression risk.
- Untestable in isolation (see `task-7.md` driver DI); `tests-new/MssqlProvider.test.ts` only covers the constructor.
- The shape is copy-pasted across all three providers — root multiplier of duplication.

## Target architecture
Apply Clean Architecture layering and composition-first design. `MssqlProvider` becomes a thin
**Facade / orchestrator** delegating to injected single-responsibility collaborators:
- `MssqlConnectionManager` — pool lifecycle, driver acquisition, health-check ping (driver via injected port, `task-7.md`).
- `ProviderCrudExecutor` (shared, `task-2.md`) — generic insert/update/delete/find on dialect + `EntityMapper` + `ValueCoercer`.
- `MssqlMergeWriter` — the MSSQL-specific `MERGE` upsert SQL (the only genuinely MSSQL-specific CRUD piece).
- `MssqlTransactionManager` — begin/commit/rollback/savepoint semantics.
- `EntityMapper` + `ValueCoercer` (shared, `task-2.md`); `ErrorTranslator` registry (shared, `task-3.md`).
SOLID: SRP per collaborator, OCP via injected strategies, DIP via ports for driver/error/mapper.

## Proposed refactor
1. Extract `MssqlConnectionManager` from `doConnect`/`doDisconnect`/health-check wiring.
2. Extract `MssqlTransactionManager` from begin/commit/rollback/savepoint methods.
3. Move `coerceToSqlParameter`/`mapRowToEntity` into shared collaborators (`task-2.md`).
4. Move `mapMssqlError` into the shared error-translation registry (`task-3.md`).
5. Reduce `MssqlProvider` to construction + delegation; keep the `DatabaseProvider` contract identical.

## Suggested design patterns
- **Facade** — stable surface, internal churn isolated (maintainability).
- **Strategy** — error translation, value coercion, merge writer swappable (extensibility).
- **Template Method** — keep `DatabaseProvider`'s `do*` hooks but make them delegate.
- **Composition over inheritance** — collaborators composed, not added as more `protected` methods (testability).

## Testing plan
- Unit: each extracted collaborator in isolation with a fake driver (`task-7.md`) — connection lifecycle, transaction state transitions, savepoint SQL, merge SQL shape.
- Contract: shared provider-contract suite (`task-6.md`) against the refactored facade.
- Regression: `tests/mssql.crud.test.ts` and snapshot tests pass unchanged.
- Error-path: forced driver errors map to typed ORM errors via the registry.

## Acceptance criteria
- [ ] `MssqlProvider` is under ~200 LOC, only construction + delegation.
- [ ] Connection, transaction, merge, mapping, coercion, error mapping live in separate units.
- [ ] All collaborators are injectable (default-constructed when not supplied).
- [ ] Public `DatabaseProvider` API and behavior unchanged.
- [ ] New unit tests cover each collaborator with a fake driver.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build`, `pnpm arch:cycles` pass.

## Refactor order
1. Land `task-7.md` (driver DI) first to enable unit testing.
2. Land `task-2.md` (shared mapper/coercer) and `task-3.md` (error registry).
3. Then perform this decomposition.

## Notes
Anchor task; `provider-mysql/task-1.md` and `provider-postgres/task-1.md` mirror it with the
same collaborator shape so the duplication tasks can collapse cleanly.
