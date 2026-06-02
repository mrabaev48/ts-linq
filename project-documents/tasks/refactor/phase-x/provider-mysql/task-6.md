---
status: not-started
phase: phase-x
package: provider-mysql
priority: P1
effort: S
risk: low
category: testing
depends_on: ["provider-mysql/task-7.md", "provider-mssql/task-6.md"]
related: ["provider-mssql/task-6.md", "provider-postgres/task-6.md"]
---

# Refactor: Bind the shared provider contract suite for MySQL (driverless)

## Problem
`tests-new/MySqlProvider.test.ts` covers only construction/config; no MySQL execution behavior
(insert-id readback, transaction state, savepoints, error mapping, Hi-Lo emulation) is unit-tested.

## Evidence
- `packages/provider-mysql/tests-new/MySqlProvider.test.ts` — constructor/config tests only.
- Untested execution: `executeInsert :165`, `doExecuteQuery :363`, `doExecuteNonQuery :377`, transactions `:414-434`, savepoints `:438-454`, `nextSequenceValue :471`.

## Why this is bad
- Critical execution code unverifiable offline; refactors (task-1) lack a safety net.

## Target architecture
Bind the shared `runProviderContract` suite (`provider-mssql/task-6.md`) with a MySQL fake driver
port (task-7), plus MySQL-specific cases: `insertId` readback, Hi-Lo update+select pair,
`ON DUPLICATE KEY` upsert.

## Proposed refactor
1. Implement a fake `MySqlPoolLike` recording SQL/params and returning scripted results.
2. Bind the contract suite and add MySQL-specific cases.

## Suggested design patterns
- **Fake (Test Double)**, **parameterized/contract test**, **Object Mother** for fixtures.

## Testing plan
- Unit: contract suite + MySQL cases run fully offline.
- Error-path: scripted errors → typed ORM errors.

## Acceptance criteria
- [ ] Contract suite bound for MySQL with a fake driver.
- [ ] insertId, Hi-Lo, upsert covered offline.
- [ ] `pnpm tests:unit` exercises MySQL execution paths with no DB.

## Refactor order
Depends on task-7 and `provider-mssql/task-6.md`.

## Notes
See anchor `provider-mssql/task-6.md`.
