---
status: not-started
phase: phase-x
package: plugin-soft-delete
priority: P1
effort: M
risk: medium
category: clean-code
depends_on: ["_shared/task-1.md"]
related: ["plugin-audit/task-4.md", "plugin-multi-tenant/task-6.md", "_shared/task-2.md"]
---

# Refactor: Entity mutation contract for soft-delete flag/timestamp writes

## Problem

`handleSoftDelete` mutates the caller's entity in place (flag + timestamp) with no immutability
guarantee and no record of what changed. The orm interceptor does the same; this task is the
plugin-side instance of the cross-cutting mutation problem.

## Evidence

- `packages/plugin-soft-delete/src/SoftDeleteMiddleware.ts:51-68`:
  ```ts
  if (context.operation === 'delete') {
    if (hasFlagColumn) context.entity[flagColumn] = true;
    if (hasTimestampColumn) context.entity[timestampColumn] = new Date();
    return true;
  } else if (context.operation === 'restore') {
    if (hasFlagColumn) context.entity[flagColumn] = false;
    if (hasTimestampColumn) context.entity[timestampColumn] = null;
    return true;
  }
  ```
- The free `restore` helper (utils.ts:20-26) likewise mutates `entity[flagColumn]`/`entity[timestampColumn]`
  unconditionally (even if the entity has no such columns).
- `entity` is bare `Record<string, unknown>` (via `EntityChangeContext`).

## Why this is bad

- **Hidden side effects / CQS:** mutation buried in a boolean-returning method.
- The `restore` helper mutates without checking metadata, so it can attach phantom columns to entities
  that do not have them (silent schema pollution).
- Untyped writes defeat entity type safety and complicate change-tracking integration.

## Target architecture

Describe intended property changes and apply them through the ORM change-tracker, or return an
explicit change set. Apply **Command-Query Separation** and a shared change-descriptor (see
`_shared/task-2`). The `restore` helper must respect metadata (only touch real columns).

## Proposed refactor

1. Have soft-delete return a `PropertyChange[]` (or apply through the change-tracker) rather than
   mutating in place inside a predicate-returning method.
2. Make `restore` metadata-aware (no phantom columns) or delegate to the surviving interceptor.
3. Tighten entity typing where feasible.

## Suggested design patterns

- **Command-Query Separation**, **Value Object** (change descriptor shared via plugin-kit),
  **Guard Clause** (metadata check before write).

## Testing plan

- `restore` on an entity lacking soft-delete columns does not add phantom properties.
- Soft-delete returns/records the exact columns it changed.

## Acceptance criteria

- [ ] Soft-delete mutation has an explicit, documented contract (returned or change-tracked).
- [ ] `restore` only touches columns that exist in metadata.
- [ ] No untyped in-place write inside a query/predicate method.

## Refactor order

1. Change-descriptor return. 2. Metadata-aware restore. 3. Type tightening. 4. Tests.

## Notes

Reuse the shared change descriptor from `_shared/task-2`; aligns with audit + tenant mutation tasks.
