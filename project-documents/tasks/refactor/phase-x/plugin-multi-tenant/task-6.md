---
status: not-started
phase: phase-x
package: plugin-multi-tenant
priority: P1
effort: M
risk: medium
category: clean-code
depends_on: ["_shared/task-1.md"]
related: ["plugin-audit/task-4.md", "plugin-soft-delete/task-5.md"]
---

# Refactor: Entity mutation contract for tenant stamping

## Problem

`applyTenant` mutates the caller's entity object in place with no contract, no immutability guarantee,
and no record of what changed. The same anti-pattern appears across all three plugins; this task
covers the multi-tenant instance.

## Evidence

- `packages/plugin-multi-tenant/src/MultiTenantMiddleware.ts:80-82`:
  ```ts
  if (context.operation === 'insert' || context.operation === 'update') {
    context.entity[tenantColumn] = tenantId;
  }
  ```
- The free helper `setTenantId` (utils.ts:54-61) also mutates `entity[column] = tenantId` in place.
- `TenantContext.entity` is `Record<string, unknown>` (via `EntityChangeContext`,
  `@ts-linq/types:323-328`), so the mutation is untyped and unbounded.

## Why this is bad

- **Hidden side effect / Command-Query separation:** a method named `applyTenant` silently rewrites a
  field on a caller-owned object; the caller cannot tell what was changed.
- No protection against the plugin clobbering a deliberately-set tenant id.
- Untyped `Record<string, unknown>` write defeats type safety on the entity.
- Makes change-tracking integration fragile (the ORM's snapshot may already track the entity).

## Target architecture

Plugins should describe *intended changes* and let the change-tracker apply them, or apply via a
documented, returned change set. Apply **Command-Query Separation** and an explicit
**immutability/ownership contract**: either (a) return a `PropertyChange[]` the ORM applies, or
(b) document that the plugin owns the column and assert it isn't already set differently.

## Proposed refactor

1. Change `applyTenant` to return the intended change (`{ column, value }`) instead of mutating, OR
   route the write through the ORM change-tracker's property-setter.
2. Guard against overwriting an explicitly-set tenant id (configurable).
3. Make `setTenantId` either return a new object or be clearly documented as a mutating helper.
4. Tighten the entity type beyond bare `Record<string, unknown>` where possible.

## Suggested design patterns

- **Command-Query Separation**, **Value Object** (change descriptor), **Builder** for batched changes.

## Testing plan

- Mutation test: applying tenant does not silently overwrite a pre-set, different tenant id (or does,
  per explicit policy).
- Returned change set matches the column written.

## Acceptance criteria

- [ ] Tenant stamping has an explicit, documented mutation contract.
- [ ] No untyped in-place write without a returned/recorded change.
- [ ] Pre-set tenant id handling is explicit and tested.

## Refactor order

1. Change descriptor return. 2. Overwrite guard. 3. Type tightening. 4. Tests.

## Notes

Shares the immutability theme with `plugin-audit/task-4` and `plugin-soft-delete/task-5`; consider a
shared change-descriptor type in the plugin-kit (`_shared/task-2`).
