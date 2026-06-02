---
status: not-started
phase: phase-x
package: provider-mysql
priority: P0
effort: M
risk: high
category: testing
depends_on: ["provider-mssql/task-7.md"]
related: ["provider-mssql/task-7.md", "provider-postgres/task-7.md"]
---

# Refactor: Invert the MySQL driver dependency (Ports & Adapters)

## Problem
`MySqlProvider` hard-requires `mysql2/promise` inside its methods and instantiates the concrete
pool, so execution code cannot be unit-tested without a real MySQL server.

## Evidence
- `safeRequireMysql2()` `packages/provider-mysql/src/MySqlProvider.ts:60-68`.
- `createPool(mysqlConfig)` `:108-110`.
- Concrete pool used directly in `executeInsert :173`, `doExecuteQuery :370`, `doExecuteNonQuery :384`, transactions `:417/:424/:431`, savepoints `:441/:447/:453`, health check `:124`.

## Why this is bad
- DIP violation; no fake seam; blocks `task-6.md` and safe `task-1.md`.
- Per-method `require()` couples wiring to execution.

## Target architecture
Apply **Ports & Adapters**. Promote `MySqlPoolLike` into a `MySqlDriverPort` (`createPool(cfg): MySqlPoolPort`),
default adapter wrapping `mysql2/promise`, injected via constructor. SOLID: DIP/SRP/OCP.

## Proposed refactor
1. Define the driver port + default adapter.
2. Inject via constructor; default to the adapter.
3. Remove per-method `require()`; use the injected port.

## Suggested design patterns
- **Ports & Adapters**, **Adapter**, **Factory**, **constructor DI**.

## Testing plan
- Unit: instantiate with a fake port; assert connect/query/transaction/savepoint behavior offline.
- Error-path: fake port throws → typed ORM errors.
- Regression: default adapter passes container CRUD tests.

## Acceptance criteria
- [ ] MySQL provider accepts an injected driver port; default adapter when omitted.
- [ ] No `require()` of `mysql2` inside per-call methods.
- [ ] Provider fully exercisable with a fake driver, no DB.
- [ ] Container tests pass with the real adapter.

## Refactor order
Foundational; aligns with `provider-mssql/task-7.md`. Land before task-6/task-1.

## Notes
See anchor `provider-mssql/task-7.md`.
