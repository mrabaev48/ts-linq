---
status: not-started
phase: phase-x
package: dialect-postgres
priority: P1
effort: M
risk: medium
category: clean-code
depends_on: []
related: ['dialect-mssql/task-3.md', 'dialect-postgres/task-5.md']
---

# Refactor: Deduplicate parameter coercion and column-selection helpers (coerce / insertableCols / numberPlaceholders)

## Problem
The value-coercion routine and the "which columns are insertable/updatable" predicates are copy-pasted
across both the dialect class and its `batch-syntax` module, and again across all three dialects — at least
six identical/near-identical copies.

## Evidence
- `coerceParameter` identical body in all three dialect classes:
  `PostgresDialect.ts:342`, `MssqlDialect.ts:305`, `MysqlDialect.ts:254`.
- `coerce` (same body) duplicated again in each `batch-syntax`:
  `dialect-postgres/src/batch-syntax.ts:30`, `dialect-mssql/src/batch-syntax.ts:15`, `dialect-mysql/src/batch-syntax.ts` (analogous).
- `applyConverter` triplicated: `PostgresDialect.ts:338`, `MssqlDialect.ts:301`, `MysqlDialect.ts:250`.
- Insertable/updatable column predicates re-derived in many spots with subtle drift:
  - PG insert excludes generated PKs heuristically (`PostgresDialect.ts:199-207`) and `batch-syntax.ts:48` `insertableCols`.
  - MSSQL insert predicate `MssqlDialect.ts:143` vs batch `MssqlDialect batch-syntax.ts:39`.
  - MySQL additionally excludes `isComputed` in INSERT (`MysqlDialect.ts:132`) while MSSQL does not (`MssqlDialect.ts:143`) — a real behavioral divergence born of duplication.
- `numberPlaceholders` (`?`→`@pN`) duplicated: `MssqlDialect.ts:108` and `dialect-mssql/src/batch-syntax.ts:34`.

## Why this is bad
- DRY/SSOT: coercion rules (what counts as a primitive vs JSON.stringify) must stay in lockstep; today they
  drift silently (see computed-column divergence above), causing dialect-specific bugs.
- Clean Code: these are pure functions with no dialect-specific behavior — pure duplication.
- Testability: one shared, well-tested coercion + column-selection module is far easier to verify than 6 copies.

## Target architecture
Extract pure, dialect-agnostic utilities (Single Responsibility, composition-first) into the shared
`@ts-linq/sql-visitor` (or new `@ts-linq/dialect-kit`):
- `coerceSqlParameter(value): SqlParameter`
- `applyConverter(value, col): unknown`
- `selectInsertableColumns(metadata, entity, options)` / `selectUpdatableColumns(metadata)` with **explicit,
  documented** options (`excludeComputed`, `excludeGeneratedPk`) so per-dialect differences become declared
  configuration, not accidental divergence.

## Proposed refactor
1. Move `coerce`/`applyConverter` to a shared module; delete the 6 copies.
2. Introduce shared column-selection functions with an options flag set; have each dialect pass its policy.
3. Reconcile the computed-column INSERT divergence intentionally (decide correct behavior, document it).

## Suggested design patterns
- **Pure utility module (SSOT)**. WHY: one tested implementation; no drift.
- **Policy object / Parameterize from above**. WHY: legitimate dialect differences become explicit inputs, not hidden code branches.

## Testing plan
- Unit tests for `coerceSqlParameter` (null, Date, Uint8Array, object, circular).
- Table-driven tests for column selection across generated/computed/PK combinations per declared policy.
- Verify the computed-column behavior is now uniform/intended on all dialects.

## Acceptance criteria
- [ ] Exactly one `coerceSqlParameter` and one `applyConverter` in the codebase.
- [ ] Shared column-selection functions; per-dialect policy is explicit.
- [ ] Computed-column INSERT divergence resolved and tested.
- [ ] `arch:dead` clean; all tests pass.

## Refactor order
1. Extract coerce/applyConverter. 2. Extract column selection + policy. 3. Reconcile divergences. 4. Tests.

## Notes
Cross-dialect; relates to the circular-reference catch noted in task-5 (the coercion fallback). Land alongside task-1/task-4 siblings.
