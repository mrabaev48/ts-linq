---
status: not-started
phase: phase-x
package: migrations
priority: P2
effort: M
risk: low
category: clean-code
depends_on: ["task-1.md"]
related: []
---

# Refactor: Clean up MigrationHandlers re-export grab-bag and structural-typing casts

## Problem

`builders/MigrationHandlers.ts` is a 359-line module that is part re-export hub, part live
logic, part dead-comment graveyard, and uses repeated ad-hoc structural-typing casts
(`as { isComputed?: boolean }`, `as { defaultExpression?: string }`) to reach properties
that should be first-class on `ColumnDef`. It also re-implements unique-constraint SQL with
raw interpolation that bypasses the quoting layer.

## Evidence

- `packages/migrations/src/builders/MigrationHandlers.ts:294-310` — a block of dead
  `// moved to handlers/…` comments left after a prior split.
- `packages/migrations/src/builders/MigrationHandlers.ts:266-290` — `isComputedColumn`,
  `hasDefaultExpression`, `isComputedChanged` read fields via inline casts like
  `(c as { isComputed?: boolean }).isComputed` and
  `(c as { computedExpression?: string }).computedExpression` — these fields are real domain
  attributes that belong on `ColumnDef` in `DiffTypes.ts`.
- `packages/migrations/src/builders/MigrationHandlers.ts:251` — `(ch.prev as { nullable?:
  boolean } | undefined)?.nullable` casts away the typed `ColumnDef`.
- `packages/migrations/src/builders/MigrationHandlers.ts:322,324,339,341` —
  unique-constraint SQL built with raw `` \`${tableName}\` `` / `[${tableName}]` rather than
  the quoting layer (overlaps task-1; this task removes the duplication).
- The module both *imports* from and *re-exports* `handlers/*`, blurring the public surface
  (`index.ts:12-16` re-exports a subset from here, the rest from `handlers/*`).

## Why this is bad

- **Type safety:** structural casts defeat the compiler — a typo in a cast key silently
  yields `undefined` at runtime; the real `ColumnDef` should carry these fields.
- **Cohesion/readability:** a file that is simultaneously a barrel, a logic module, and a
  comment graveyard is hard to navigate.
- **Duplication:** unique-constraint quoting duplicates the quoting layer and the
  per-dialect logic, and bypasses task-1's escaping fix.

## Target architecture

Apply **Clean Code** (intention-revealing modules, no dead code) and TypeScript
type-first rules (model the data, don't cast to it).

- Promote computed/default/comment fields to first-class optional members on `ColumnDef`
  in `DiffTypes.ts`; delete the inline casts.
- Move the unique-constraint builders to a single home (e.g. `UniqueConstraintsSqlBuilder`,
  which already exists) and route them through the task-1 quoter; have `MigrationHandlers`
  re-export from there if back-compat re-exports are needed.
- Make `MigrationHandlers.ts` a pure barrel (re-exports only) or delete it in favour of
  importing from `handlers/*` directly, after confirming the public `index.ts` surface.

## Proposed refactor

1. Extend `ColumnDef` (`DiffTypes.ts`) with the optional fields currently reached by cast.
2. Replace the cast-based predicates with typed property access.
3. Consolidate the unique-constraint SQL into `UniqueConstraintsSqlBuilder` using the
   quoter; update `index.ts` re-exports accordingly (keep exported names stable).
4. Delete the dead `// moved to …` comments.

Public API: the names re-exported from `index.ts`
(`buildAddUniqueConstraintSql`, `buildDropUniqueConstraintSql`, etc.) must remain importable
to avoid a breaking change.

## Suggested design patterns

- **Type-first modelling** — put data on the type, not in casts. Why: compile-time safety.
- **Barrel/Facade discipline** — a module is either logic or re-exports, not both. Why:
  clear public surface.
- **Consolidation (DRY)** — one home per SQL concern. Why: removes the task-1 bypass.

## Testing plan

- **Type-level:** removing the casts must still compile; add a type test asserting the new
  `ColumnDef` fields.
- **Regression:** existing handler/builder tests pass; unique-constraint SQL output is
  unchanged for non-adversarial names and now escaped for adversarial ones (task-1 cases).

## Acceptance criteria

- [ ] Computed/default/comment fields are typed on `ColumnDef`; no inline casts in the
      predicates.
- [ ] Unique-constraint SQL lives in one builder and uses the quoter.
- [ ] Dead `// moved to …` comments removed.
- [ ] All names previously exported from `index.ts` remain importable.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Land task-1 (quoter) first.
2. Extend `ColumnDef`, remove casts.
3. Consolidate unique-constraint SQL; tidy the barrel.

## Notes

Verify with the consumers (CLI `SchemaApplyCommand`, `index.ts`) which symbols are public
before moving anything.
