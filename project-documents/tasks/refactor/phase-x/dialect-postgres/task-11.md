---
status: not-started
phase: phase-x
package: dialect-postgres
priority: P2
effort: S
risk: low
category: package-boundary
depends_on: ['dialect-postgres/task-7.md']
related: ['dialect-postgres/task-8.md']
---

# Refactor: Complete the `formatValue` consolidation (single SSOT in dialect-kit)

## Problem
task-7 relocated `formatValue` to `@ts-linq/dialect-kit` (`src/params/format-value.ts`) and repointed
the three DDL strategies to it, removing the dialect→core edge in the DDL surface. To keep task-7 a
non-breaking `patch`, the original `SqlHelper.formatValue` was **left in place** in `@ts-linq/core`,
and `@ts-linq/migrations` still has its own `formatValue` in `SqlUtils`. There are now up to three
copies of the same inline-value formatter.

## Evidence
- `packages/dialect-kit/src/params/format-value.ts` — the new SSOT (task-7).
- `packages/core/src/utils/SqlHelper.ts:55` — `SqlHelper.formatValue` retained (still exported;
  covered by `packages/core/tests-new/SqlHelper.test.ts`).
- `packages/migrations/src/builders/SqlUtils.ts:56` — a third, dialect-aware `formatValue`.

## Why this is bad
- Three copies of the same escaping logic can drift (e.g. a Date/boolean/quote-escaping fix applied
  in one place only) — the same duplication class task-7 removed among the dialects.
- `SqlHelper.formatValue` is now dead weight in `core` for the DDL use case.

## Target architecture
- One `formatValue` SSOT in `@ts-linq/dialect-kit`.
- Remove `SqlHelper.formatValue` from `@ts-linq/core` (audit remaining internal callers first; move
  or repoint them). This is a **breaking** change to `@ts-linq/core`'s public surface → `major`
  changeset + migration note.
- Fold the migrations `SqlUtils.formatValue` into the shared SSOT (dialect-kit) or its safe-quoting
  layer, coordinating with `task-10` / `migrations/task-3`.

## Proposed refactor
1. Grep every `SqlHelper.formatValue` / `SqlUtils.formatValue` caller.
2. Repoint them at the dialect-kit SSOT (or the migrations safe-quoter that wraps it).
3. Remove the duplicate definitions; migrate the `SqlHelper.test.ts` coverage to the SSOT.
4. `major` changeset for `@ts-linq/core` (removed export) with a migration note.

## Acceptance criteria
- [ ] Exactly one `formatValue` implementation remains (dialect-kit SSOT).
- [ ] `SqlHelper.formatValue` removed from `@ts-linq/core`; all callers repointed.
- [ ] `major` changeset for `@ts-linq/core` with migration guidance.
- [ ] `pnpm typecheck`, `pnpm tests:unit`, `pnpm build`, `arch:*` pass.

## Notes
Deferred from task-7 (which intentionally kept core's copy to stay a `patch`). Coordinate with
`task-8` (dialect→core/metadata decoupling) — this is a concrete slice of that decoupling.
