---
status: not-started
phase: phase-x
package: plugin-audit
priority: P1
effort: S
risk: medium
category: typescript
depends_on: ["_shared/task-1.md"]
related: []
---

# Refactor: Reuse `EntityChangeContext` and remove the interface/class name collision

## Problem

`plugin-audit` redefines an entity-change context (`AuditContext`) that overlaps the shared
`EntityChangeContext`, and declares an `interface AuditMiddleware` with the *same name* as the
exported `class AuditMiddleware`, with hooks the class never implements.

## Evidence

- `packages/plugin-audit/src/types.ts:62-68` — `AuditContext { entity, entityClass, state:
  'added'|'modified'|'deleted', timestamp?, currentUser? }`.
- `packages/types/src/index.ts:323-328` — `EntityChangeContext { entity, entityClass, state:
  'added'|'modified'|'deleted', originalValues? }` — same `state` union, overlapping shape.
- Multi-tenant and soft-delete *do* extend `EntityChangeContext` (`plugin-multi-tenant/src/types.ts:36`,
  `plugin-soft-delete/src/types.ts:36`); audit alone re-declares it from scratch — inconsistent.
- `packages/plugin-audit/src/types.ts:73-76` — `interface AuditMiddleware extends OrmMiddleware`
  collides with `class AuditMiddleware` (`AuditMiddleware.ts:8`); re-exported as `IAuditMiddleware`
  (`index.ts:8`).

## Why this is bad

- **DRY / Single Source of Truth:** the change-context concept is defined twice with drift risk
  (audit's adds `timestamp`/`currentUser`, drops `originalValues`).
- **Naming collision:** two distinct shapes named `AuditMiddleware` is confusing and only works because
  one is re-aliased. A reader cannot tell `AuditMiddleware` (class) from `AuditMiddleware` (interface).
- Inconsistent with the sibling plugins, which extend the shared context.

## Target architecture

`AuditContext extends EntityChangeContext` (adding only `timestamp?`/`currentUser?`), matching the
sibling plugins. Resolve the name collision by deleting the redundant interface (the lifecycle port
from `_shared/task-1` is the real contract) or renaming it unambiguously. Apply **Single Source of
Truth** and **consistent naming**.

## Proposed refactor

1. Change `AuditContext` to extend `EntityChangeContext`.
2. Delete the `interface AuditMiddleware`/`IAuditMiddleware` (superseded by the lifecycle port) or
   rename to a non-colliding name.
3. Update `index.ts` exports accordingly + changeset.

## Suggested design patterns

- **Single Source of Truth**, **Interface Segregation**, consistent naming (no class/interface clash).

## Testing plan

- Type-level test: `AuditContext` is assignable to `EntityChangeContext`.
- No two exported symbols share the name `AuditMiddleware`.

## Acceptance criteria

- [ ] `AuditContext extends EntityChangeContext`.
- [ ] No interface/class name collision remains.
- [ ] Consistent with sibling plugins' context modelling.
- [ ] Changeset added.

## Refactor order

1. Extend shared context. 2. Remove/rename interface. 3. Fix exports + changeset.

## Notes

Pairs with `_shared/task-1`, which removes the dependence on the redundant interface entirely.
