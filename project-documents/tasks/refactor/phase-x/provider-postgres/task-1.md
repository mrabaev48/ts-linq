---
status: not-started
phase: phase-x
package: provider-postgres
priority: P0
effort: XL
risk: high
category: architecture
depends_on: []
related: ["provider-mssql/task-1.md", "provider-mysql/task-1.md"]
---

# Refactor: Decompose `PostgresProvider` god class into focused collaborators

## Problem
`PostgresProvider` (578 LOC) conflates module-global driver loading, pool lifecycle + idle-error
handling, health checks, DDL, CRUD, raw `ON CONFLICT` upsert SQL, transaction control on a pinned
client, entity mapping + Postgres type reading, value coercion (ltree/EWKB/JSON), sequence
reservation, and error/transient translation — in one class on the query hot path.

## Evidence
- `packages/provider-postgres/src/PostgresProvider.ts:59` — class declaration.
- Module-global driver: top-level `require('pg')` `:21`; pool creation `:150`; idle-error handler `:154-157`.
- Mapping/type reading: `mapRowToEntity :67-85` (routes through `convertValueFromPg :76`), free `convertValueForPg :537`, `convertValueFromPg :549`.
- Coercion: `coerceToSqlParameter :110-132`.
- CRUD: `insert :204`, `update :221`, `upsert :258`, `delete :294`, `findById :326`, `findAll :352`, `findWhere :365`, `findWhereIn :389`.
- Raw `ON CONFLICT` upsert SQL: `:287`.
- Transactions (pinned client): `doBeginTransaction :462-482`, commit `:484-495`, rollback `:497-508`.
- Error map `mapPgError :569`; transient override `:511`.

## Why this is bad
- SRP violation; hot-path execution interleaved with driver wiring and idle-error policy.
- The copy-pasted shape across providers multiplies maintenance (see related tasks).
- The type-reading layer (`convertValueFromPg`) is Postgres-specific glue embedded in the god class.

## Target architecture
Thin **Facade** delegating to injected collaborators (Clean Architecture, composition-first):
`PgConnectionManager` (pool + idle-error policy + driver port from task-7), `ProviderCrudExecutor`
(shared, task-2), `PgUpsertWriter` (dialect-owned, task-5), `PgTransactionManager` (pinned client),
shared `EntityMapper` with a Postgres `TypeReader` wrapping `convertValueFromPg`, shared
`ValueCoercer` + `ErrorTranslator` (task-2/task-3). SOLID: SRP/DIP/OCP.

## Proposed refactor
1. Extract connection manager (owns the idle-error handler) and transaction manager.
2. Move `convertValueForPg`/`convertValueFromPg` behind the shared mapper/coercer as a Postgres `TypeReader`/encoder (task-2).
3. Move `mapPgError` to the shared registry (task-3).
4. Reduce `PostgresProvider` to construction + delegation; keep the `DatabaseProvider` contract identical.

## Suggested design patterns
- **Facade**, **Strategy** (type reader/encoder/error/upsert), **Template Method** (keep `do*` hooks delegating), **Composition over inheritance**.

## Testing plan
- Unit: collaborators with a fake `pg` port (task-7) — connect/idle-error, transaction pinning, RETURNING readback.
- Contract: shared suite (task-6).
- Regression: `tests/postgres.*` (crud, cte, snapshots) unchanged.
- Error-path: forced driver errors map via the registry.

## Acceptance criteria
- [ ] `PostgresProvider` under ~200 LOC, construction + delegation only.
- [ ] Type reading lives behind the shared mapper as a `TypeReader`.
- [ ] Mapping/coercion/error mapping in shared units.
- [ ] Public API + behavior unchanged.
- [ ] Unit tests cover each collaborator with a fake driver.
- [ ] `pnpm typecheck`/`lint`/`tests:unit`/`build`/`arch:cycles` pass.

## Refactor order
After task-7 (driver DI, also fixes the broken MetricsSafe path), task-2/task-3, then decompose.

## Notes
Mirrors `provider-mssql/task-1.md`. Postgres is the cleanest transaction implementation (already
pins a client) — preserve that as the reference for the MySQL fix (`provider-mysql/task-8.md`).
