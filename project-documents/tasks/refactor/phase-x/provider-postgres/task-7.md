---
status: not-started
phase: phase-x
package: provider-postgres
priority: P0
effort: M
risk: high
category: testing
depends_on: ["provider-mssql/task-7.md"]
related: ["provider-mssql/task-7.md", "provider-mysql/task-7.md"]
---

# Refactor: Invert the Postgres driver dependency and fix the broken `MetricsSafe` require

## Problem
`PostgresProvider` loads `pg` into a **module-global** at import time and instantiates `new Pool`
directly, so execution code cannot be unit-tested without a real database. The require-failure
fallback additionally references a **non-existent module path**, and the failure is silently
swallowed.

## Evidence
- Module-global driver: `packages/provider-postgres/src/PostgresProvider.ts:18-32` (`require('pg')` into `Pg`).
- **Broken path:** `:25` `require('../utils/MetricsSafe')` — there is no `packages/provider-postgres/src/utils/MetricsSafe`; the real module is `@ts-linq/metrics-safe` (`packages/metrics-safe/src/lib/MetricsSafe.ts`). The inner `catch {}` at `:29` therefore always swallows, so the intended `warnIfLoggerDebug('require(pg)', e)` warning never fires.
- Pool creation: `new Pool(pgConfig)` `:150`; pool used directly in `doExecuteQuery :421`, `doExecuteNonQuery :435`, transactions `:465-507`, health check `:170`.

## Why this is bad
- DIP violation; module-global require defeats any fake seam → blocks task-6 and safe task-1.
- The broken `../utils/MetricsSafe` path is a real (dead) bug hidden behind a silent catch — a missing `pg` install produces no diagnostic at all.

## Target architecture
Apply **Ports & Adapters**: promote `PgPoolLike`/`PgClientLike` into a `PgDriverPort`
(`createPool(cfg): PgPoolPort`), default adapter wrapping `pg`, injected via constructor. Fix the
diagnostic path to import `@ts-linq/metrics-safe` (or drop the dead branch) and stop swallowing the
require error silently. SOLID: DIP/SRP/OCP.

## Proposed refactor
1. Define the driver port + default adapter (lazy single `require('pg')`).
2. Inject via constructor; default to the adapter.
3. Remove the module-global `Pg`; obtain the pool from the injected port.
4. Replace `require('../utils/MetricsSafe')` with `@ts-linq/metrics-safe` and log the failure (don't swallow).

## Suggested design patterns
- **Ports & Adapters**, **Adapter**, **Factory**, **constructor DI**.

## Testing plan
- Unit: instantiate with a fake `pg` port; assert connect/query/transaction behavior offline.
- Unit: simulate missing driver → a diagnostic is emitted (not silently swallowed).
- Regression: default adapter passes container CRUD + CTE + snapshot tests.

## Acceptance criteria
- [ ] Postgres provider accepts an injected driver port; default adapter when omitted.
- [ ] No module-global `require('pg')`.
- [ ] The `MetricsSafe` import is corrected to `@ts-linq/metrics-safe` (or removed) and the require failure is logged.
- [ ] Provider fully exercisable with a fake driver, no DB.
- [ ] Container tests pass with the real adapter.

## Refactor order
Foundational; aligns with `provider-mssql/task-7.md`. Land before task-6/task-1.

## Notes
The broken-import bug is the highest-value Postgres-specific fix here. See anchor
`provider-mssql/task-7.md`.
