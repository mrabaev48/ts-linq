---
status: not-started
phase: phase-x
package: plugin-audit
priority: P1
effort: M
risk: medium
category: clean-code
depends_on: ["_shared/task-1.md"]
related: ["plugin-multi-tenant/task-6.md", "plugin-soft-delete/task-5.md", "_shared/task-2.md"]
---

# Refactor: Entity mutation contract for audit stamping

## Problem

`AuditMiddleware` writes audit columns directly onto the caller's entity object with no immutability
guarantee and no record of what changed — the cross-cutting plugin-mutation anti-pattern, audit instance.

## Evidence

- `packages/plugin-audit/src/AuditMiddleware.ts:60-65` (`applyCreatedAudit`) and `:82-85`
  (`applyUpdatedAudit`):
  ```ts
  entity[createdAtCol] = now;
  if (... && currentUser !== undefined) entity[createdByCol] = currentUser;
  ...
  entity[updatedAtCol] = now;
  ```
- `entity` is `Record<string, unknown>` (`applyCreatedAudit(... entity: Record<string, unknown> ...)`,
  line 52) — untyped, unbounded writes.

## Why this is bad

- **Hidden side effect / CQS:** `applyAudit` mutates a caller-owned object opaquely.
- No way to know which columns were stamped (complicates change-tracking / dirty detection).
- Untyped writes defeat entity type safety.

## Target architecture

Return intended changes (or apply through the orm change-tracker) instead of mutating in place. Reuse
the shared change descriptor from `_shared/task-2`. Apply **Command-Query Separation** and an explicit
mutation/immutability contract.

## Proposed refactor

1. Refactor `applyCreatedAudit`/`applyUpdatedAudit` to produce `PropertyChange[]` (or write via the
   change-tracker) rather than mutating the entity directly.
2. Document the ownership contract (audit owns the audit columns).
3. Tighten entity typing where feasible.

## Suggested design patterns

- **Command-Query Separation**, **Value Object** (change descriptor), **Builder** (batch changes).

## Testing plan

- The returned/recorded change set exactly matches the audit columns present in metadata.
- Mutation does not occur for columns absent from metadata.

## Acceptance criteria

- [ ] Audit stamping has an explicit, documented mutation contract.
- [ ] No untyped in-place write without a returned/recorded change.

## Refactor order

1. Change-descriptor return. 2. Type tightening. 3. Tests.

## Notes

Shares the change-descriptor design with `plugin-soft-delete/task-5` and `plugin-multi-tenant/task-6`
via `_shared/task-2`.
