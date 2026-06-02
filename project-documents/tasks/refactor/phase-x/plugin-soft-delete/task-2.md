---
status: not-started
phase: phase-x
package: plugin-soft-delete
priority: P1
effort: S
risk: medium
category: typescript
depends_on: ["_shared/task-1.md"]
related: []
---

# Refactor: Replace the `__hardDelete` magic-string side channel

## Problem

To signal "bypass soft delete and hard-delete this row", the plugin writes a magic string property
`__hardDelete` onto the user's entity object. This is an untyped, stringly-typed protocol smuggled
through entity state.

## Evidence

`packages/plugin-soft-delete/src/utils.ts:46-60`:

```ts
export function markForHardDelete(entity: Record<string, unknown>): void {
  const key = '__hardDelete';
  entity[key] = true;
}
export function isMarkedForHardDelete(entity: Record<string, unknown>): boolean {
  const key = '__hardDelete';
  return entity[key] === true;
}
```

- The marker is set on the entity but **nothing reads it** in the soft-delete decision path
  (`SoftDeleteMiddleware.handleSoftDelete` does not check `isMarkedForHardDelete`), so the bypass
  does not actually work — it is both an anti-pattern and dead.
- `SoftDeleteContext.operation` already includes `'hardDelete'` (`types.ts:37`), so there are two
  competing mechanisms for the same intent.

## Why this is bad

- **Stringly-typed protocol / leaky abstraction:** a framework concern is stored on the domain object
  and could collide with real columns, be persisted, or be serialized accidentally.
- **Dead bypass:** the marker is never consulted by the delete logic — hard-delete intent is silently ignored.
- Two redundant ways (`operation: 'hardDelete'` vs `__hardDelete` marker) to express one decision.

## Target architecture

Express the hard-delete decision through the typed delete API / `SoftDeleteContext.operation`
(or a typed parameter on the remove call), never via a property smuggled onto the entity. Apply
**Make illegal states unrepresentable** and **Command pattern** (the delete command carries the
hard-delete flag).

## Proposed refactor

1. Remove `markForHardDelete`/`isMarkedForHardDelete` and the `__hardDelete` key.
2. Route hard-delete intent through `operation: 'hardDelete'` (or a typed delete option) consumed by
   the surviving soft-delete implementation.
3. Ensure the surviving implementation actually honours the hard-delete path (with a test).
4. Changeset (`major` — removes public helpers).

## Suggested design patterns

- **Command** (delete carries intent), **Make illegal states unrepresentable** (typed operation enum),
  no magic strings on domain objects.

## Testing plan

- Hard-delete intent results in a real DELETE, not a soft-delete UPDATE.
- No `__hardDelete` property is ever written to an entity.

## Acceptance criteria

- [ ] `__hardDelete` magic string removed.
- [ ] Hard-delete intent expressed via a typed API and actually honoured.
- [ ] No framework flag stored on domain entities.
- [ ] Changeset added.

## Refactor order

1. Decide typed intent channel. 2. Remove marker helpers. 3. Wire/honour hard-delete. 4. Tests.

## Notes

Coordinate with `task-1`: the surviving implementation must implement the hard-delete path that the
marker pretended to enable.
