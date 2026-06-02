---
status: not-started
phase: phase-x
package: plugin-multi-tenant
priority: P1
effort: M
risk: high
category: error-handling
depends_on: []
related: ["plugin-multi-tenant/task-4.md"]
---

# Refactor: Fail-closed tenant isolation (no silently unfiltered queries)

## Problem

When the current tenant cannot be resolved, the middleware silently returns "no filter" in non-strict
mode, and `getTenant()` swallows resolver errors and returns `undefined`. Both behaviours can turn a
tenant-scoped query into a cross-tenant query — a data-isolation breach.

## Evidence

- `packages/plugin-multi-tenant/src/MultiTenantMiddleware.ts:32-46` — `getTenant()`:
  ```ts
  try { return await Promise.resolve(this.options.getCurrentTenant()); }
  catch { return undefined; }
  ```
  Bare catch, no logging, no rethrow.
- `MultiTenantMiddleware.ts:88-100` — `getFilterCondition()`: if `tenantId === undefined`, returns
  `null` (no filter) unless `strictMode`. Combined with the swallow above, a thrown resolver →
  `undefined` → `null` filter → unfiltered query.
- Default is `strictMode: true` (line 17), but it is overridable, and `applyTenant` only throws in
  strict mode too (line 74-78).

## Why this is bad

- **Fail-open security posture:** the safe default for isolation is to deny/raise, not to widen the
  query. A resolver failure should never broaden data visibility.
- **Bare catch swallow** loses the root cause (classify: invalid silent swallow).
- The two failure modes (no tenant set vs resolver threw) are conflated into one `undefined`.

## Target architecture

Explicit isolation **Policy** with a fail-closed default. Distinguish "no tenant configured" from
"resolver failed". Errors propagate as typed domain errors; logging via the project's diagnostic sink.
Apply the **error-handling-patterns**: typed error hierarchy + no Pokemon-catch.

## Proposed refactor

1. Remove the bare catch in `getTenant`; let resolver errors propagate (or wrap in a typed
   `TenantResolutionError`).
2. Make the default policy fail-closed: a missing tenant for an isolated query raises, not returns null.
3. If a "lax/no-isolation" mode is genuinely needed, make it an explicit, named option
   (`isolation: 'required' | 'optional'`) that is documented and tested — not an accidental `undefined`.
4. Route diagnostics through the shared logger rather than swallowing.

## Suggested design patterns

- **Policy object** for isolation mode. **Typed error hierarchy** (`TenantResolutionError`,
  `MissingTenantContextError`). **Null Object** only where genuinely safe.

## Testing plan

- Resolver throws → error surfaces (not swallowed, query not run).
- Tenant unset + isolation required → raises.
- Tenant unset + isolation optional (explicit) → documented behaviour, tested.
- No path produces an unfiltered query when isolation is required.

## Acceptance criteria

- [ ] No bare `catch { return undefined }` in the package.
- [ ] Resolver failures are distinguishable from unset tenant.
- [ ] Default isolation is fail-closed.
- [ ] Lax mode is explicit and documented, not implicit.

## Refactor order

1. Typed errors. 2. Remove swallow. 3. Fail-closed default + explicit lax mode. 4. Tests.

## Notes

Pairs with `task-4`; together they make tenant filtering both safe (parameterized) and fail-closed.
