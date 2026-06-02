---
status: not-started
phase: phase-x
package: provider-mssql
priority: P0
effort: L
risk: high
category: testing
depends_on: []
related: ["provider-mysql/task-7.md", "provider-postgres/task-7.md"]
---

# Refactor: Invert the driver dependency (Ports & Adapters) so providers are unit-testable

## Problem
Each provider hard-couples to its concrete driver: it `require()`s the driver module inside its
own methods and instantiates concrete classes (`new mssql.ConnectionPool(...)`,
`mysql.createPool(...)`, `new Pool(...)`). There is no seam to substitute the driver, so the
execution code can only be exercised against a real database. This is the root cause of the
testability gap in `task-6.md`.

## Evidence
- MSSQL: `safeRequireMssql()` `MssqlProvider.ts:658`, called inside `doConnect :111`, `doExecuteQuery :432`, `doExecuteNonQuery :450`, `getExplainPlan :471`, `doBeginTransaction :497`; `new (...).ConnectionPool(mssqlConfig)` `:140`; `new mssql.Request(...)` `:434`,`:452`,`:471`; `new mssql.Transaction(...)` `:498`.
- MySQL: `safeRequireMysql2()` `MySqlProvider.ts:60`, `createPool(mysqlConfig)` `:108`.
- Postgres: top-level `require('pg')` into module-global `Pg` `PostgresProvider.ts:21`; `new Pool(pgConfig)` `:150`.
- Postgres also references a **non-existent** module on the require-failure path: `require('../utils/MetricsSafe')` `PostgresProvider.ts:25` — there is no `src/utils/MetricsSafe`; the real module is `@ts-linq/metrics-safe`. The fallback warning is therefore dead and the `catch` at `:29` always swallows.

## Why this is bad
- Dependency Inversion violation: high-level provider logic depends on a concrete low-level driver.
- Per-call `require()` inside hot-path methods couples I/O wiring to query execution.
- No fake/stub seam → no offline unit tests (blocks `task-6.md` and safe `task-1.md`).
- The broken `../utils/MetricsSafe` path is a latent bug masked by a silent `catch`.

## Target architecture
Apply **Ports & Adapters (Hexagonal)**. Define a narrow driver **port** per provider family,
e.g. `MssqlDriverPort { createPool(cfg): PoolPort; createRequest(parent): RequestPort; createTransaction(pool): TxPort }`,
with a default **adapter** wrapping the real `mssql`/`mysql2`/`pg` module. Inject the port via the
constructor (default to the real adapter when omitted). The provider depends only on the port
interfaces it already defines (`MssqlRequestLike`, `PgPoolLike`, `MySqlPoolLike`). SOLID: DIP
(provider → port abstraction), SRP (driver acquisition isolated in the adapter), OCP (swap adapter
for tests or alternative drivers).

## Proposed refactor
1. Promote the existing `*Like` interfaces into explicit port interfaces.
2. Add a default adapter that lazily `require()`s the real driver once.
3. Add an optional constructor param (or factory option) for the driver port; default to the adapter.
4. Remove per-method `require()`; obtain the port from a field.
5. Fix the Postgres `../utils/MetricsSafe` path to import `@ts-linq/metrics-safe` (or remove the dead branch entirely) and stop swallowing the require error silently.

## Suggested design patterns
- **Ports & Adapters / Hexagonal** — driver behind an interface.
- **Adapter** — wrap the third-party driver to the port shape.
- **Factory** — driver-port factory for adapter vs fake selection.
- **Dependency Injection (constructor)** — supply the port.

## Testing plan
- Unit: instantiate each provider with a fake driver port; assert connect/disconnect, query/non-query, transaction, savepoint behavior with no real DB (feeds `task-6.md`).
- Error-path: fake port throws driver errors → assert typed ORM errors.
- Regression: with the default adapter, container CRUD tests pass unchanged.

## Acceptance criteria
- [ ] Each provider accepts an injected driver port; default adapter used when omitted.
- [ ] No `require()` of a driver inside per-call execution methods.
- [ ] Providers are instantiable and fully exercisable with a fake driver, no DB.
- [ ] The Postgres `../utils/MetricsSafe` broken path is fixed or removed; the require failure is no longer silently swallowed.
- [ ] Container CRUD tests still pass with the real adapter.

## Refactor order
Foundational — land before `task-6.md` and `task-1.md`.

## Notes
Cross-cutting; filed under mssql. The Postgres broken-import detail is captured here because it
shares the same root (driver acquisition). See `provider-mysql/task-7.md`, `provider-postgres/task-7.md`.
