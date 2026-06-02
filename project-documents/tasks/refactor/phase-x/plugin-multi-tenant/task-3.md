---
status: not-started
phase: phase-x
package: plugin-multi-tenant
priority: P2
effort: S
risk: low
category: clean-code
depends_on: ["plugin-multi-tenant/task-2.md"]
related: []
---

# Refactor: Remove the no-op `createTenantScope` helper

## Problem

`createTenantScope` is exported as if it scopes execution to a tenant, but it ignores its `tenantId`
argument entirely and never sets any tenant — it is a misleading dead helper.

## Evidence

`packages/plugin-multi-tenant/src/utils.ts:19-27`:

```ts
export function createTenantScope<T>(tenantId: string | number, fn: () => T | Promise<T>): () => Promise<T> {
  return async () => {
    // This will be used with middleware.setTenant()
    return await Promise.resolve(fn());   // tenantId never used
  };
}
```

`tenantId` is accepted, the comment promises it "will be used with middleware.setTenant()", but it is
never read. Exported from `index.ts:13`.

## Why this is bad

- A function whose name and signature promise tenant scoping but does nothing is worse than absent —
  callers will rely on isolation that never happens (silent cross-tenant execution).
- Dead parameter; the TODO-comment shipped as public API.

## Target architecture

Either delete the helper, or implement it correctly as the `runWithTenant` scope from
`task-2` (AsyncLocalStorage-backed). The correct version is the natural home for tenant scoping.

## Proposed refactor

1. After `task-2` lands `runWithTenant`, either remove `createTenantScope` or re-implement it to
   delegate to the ambient scope.
2. If kept, add tests proving the tenant is active inside `fn` and cleared after.
3. Changeset (`minor` if replaced, `major` if removed from public surface).

## Suggested design patterns

- **Scoped Execution** (delegating to `task-2`'s ambient context). **Null Object** is NOT acceptable
  here — silently doing nothing is the bug.

## Testing plan

- Inside the scope, `getTenant()` returns the scoped tenant; outside, it does not.
- Removal: confirm no remaining importers.

## Acceptance criteria

- [ ] `createTenantScope` either correctly scopes the tenant or is removed.
- [ ] No exported function silently ignores its scoping argument.
- [ ] Changeset added.

## Refactor order

1. Land `task-2`. 2. Reimplement or delete. 3. Tests/changeset.

## Notes

Low effort but real correctness/honesty bug; depends on the ambient-context work in `task-2`.
