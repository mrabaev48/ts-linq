---
status: not-started
phase: phase-x
package: plugin-soft-delete
priority: P2
effort: S
risk: low
category: typescript
depends_on: ["_shared/task-5.md"]
related: ["_shared/task-5.md"]
---

# Refactor: Reconcile plugin-local `SoftDeleteOptions` with the canonical type

## Problem

This package defines its own `SoftDeleteOptions` that diverges from the one in `@ts-linq/types`,
creating two importable, incompatible types with the same name and meaning.

## Evidence

- `packages/plugin-soft-delete/src/types.ts:6-31` — local `SoftDeleteOptions { enabled, column,
  deletedAtColumn, type, filterDeleted }`.
- `packages/types/src/index.ts:382-389` — canonical `SoftDeleteOptions { enabled, column, columnName,
  deletedAtColumn, type }` (has `columnName`, lacks `filterDeleted`).
- The wired interceptor uses the `@ts-linq/types` version (`SoftDeleteInterceptor.ts:6`).

## Why this is bad

- Two types, one name → import-site confusion and silent incompatibility.
- `filterDeleted` exists only here; `columnName` only there — neither is universally honoured.

## Target architecture

One canonical `SoftDeleteOptions` in `@ts-linq/types`; the plugin (if it survives) re-exports it.
This is the package-level slice of `_shared/task-5`. Apply **Single Source of Truth**.

## Proposed refactor

1. Delete the local `SoftDeleteOptions`; import/re-export the canonical one (per `_shared/task-5`).
2. Reconcile `filterDeleted` and `type` into the canonical type or drop them with rationale.
3. Changeset.

## Suggested design patterns

- **Single Source of Truth**, **Interface Segregation** (split query-filter vs mutation options if both kept).

## Testing plan

- Type-level test: only one `SoftDeleteOptions` reachable from the package's public surface.

## Acceptance criteria

- [ ] No plugin-local duplicate of `SoftDeleteOptions`.
- [ ] Fields reconciled with the canonical type.
- [ ] Changeset added.

## Refactor order

1. Land `_shared/task-5`. 2. Re-export canonical type here. 3. Changeset.

## Notes

Subsumed by `_shared/task-5`; kept as a package-scoped checklist item.
