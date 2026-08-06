---
status: completed
phase: phase-x
package: dialect-postgres
priority: P2
effort: M
risk: medium
category: package-boundary
depends_on: ['dialect-postgres/task-7.md']
related: ['migrations/task-3.md']
---

# Refactor: Converge the parallel migrations DDL generator onto the shared `DdlStrategy`

## Problem
task-7 unified the dialect `*DdlStrategy` classes behind `AbstractDdlStrategy` + `TypeMapper` in
`@ts-linq/dialect-kit`. But a **second, independent DDL generator** lives in `@ts-linq/migrations`
(`src/builders/handlers/ColumnHandlers.ts` + `src/builders/SqlUtils.ts`) with its **own**
`mapType(dialect, type)`, `q(dialect, name)` quoting, `formatValue(dialect, value)`, and inline
column-comment logic. The migrations diff/codegen path therefore emits DDL through a completely
separate code path that duplicates — and can drift from — the dialect strategies.

## Evidence
- `packages/migrations/src/builders/handlers/ColumnHandlers.ts:57-59` — per-dialect column
  definition with an inline `dialect === 'mysql' && c.comment ? ` COMMENT '…'`` branch, mirroring
  (but separate from) `MySqlDdlStrategy.renderScalarColumn`.
- `packages/migrations/src/builders/SqlUtils.ts` — own `mapType`, `q`, `formatValue`.
- `packages/dialect-*/src/*DdlStrategy.ts` — the canonical strategies (now `implements DdlStrategy`).
- Two type-mapping tables and two quoting paths for the same dialects → the exact drift class task-7
  eliminated within the dialect packages, still present across the migrations↔dialect boundary.

## Why this is bad
- Two sources of truth for logical→physical type mapping, identifier quoting, and column definitions
  means a fix in one (e.g. a new type, a quoting/escaping correction) silently misses the other.
- The task-3 security work (escaped `quoteIdentifier`/`quoteStringLiteral`) is centralized in the
  dialects but the migrations path re-implements quoting independently — a latent re-divergence of
  the same injection-safety concern.

## Target architecture
- `@ts-linq/migrations` consumes the dialect `DdlStrategy` (via the `@ts-linq/types` contract) for
  column/table/constraint DDL instead of `ColumnHandlers`/`SqlUtils`' private emitters.
- Delete the duplicate `mapType`/`q`/`formatValue`/inline-comment logic from `SqlUtils`/
  `ColumnHandlers`, or reduce them to thin adapters over the shared strategy + dialect-kit SSOT.
- Verify byte-equality of the emitted migration DDL against the current golden migration output.

## Proposed refactor
1. Inject a `DdlStrategy` (or a small factory keyed by dialect) into the migration builders.
2. Route column/PK/check/FK/unique/comment emission through the strategy.
3. Remove the migrations-local `mapType`/quoting/`formatValue` duplicates (coordinate with
   `migrations/task-3` safe-codegen).
4. Snapshot migration DDL before/after; reconcile any intentional differences.

## Acceptance criteria
- [ ] `@ts-linq/migrations` DDL codegen depends on `DdlStrategy`, not private per-dialect emitters.
- [ ] The duplicate `mapType`/`q`/`formatValue`/inline-comment logic is removed or thinned to adapters.
- [ ] Migration DDL output is byte-identical (snapshot) except documented reconciliations.
- [ ] `pnpm typecheck`, `pnpm tests:unit`, `pnpm test:integration`, `pnpm build`, `arch:*` pass.

## Notes
This is the cross-boundary half of the DDL dedup; task-7 unified the dialect side, this unifies the
migrations consumer side. Overlaps `migrations/task-3` — coordinate to avoid double work.
