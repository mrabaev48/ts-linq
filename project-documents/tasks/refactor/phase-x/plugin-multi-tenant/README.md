# Refactor Audit: plugin-multi-tenant

## Package responsibility

`@ts-linq/plugin-multi-tenant` is meant to provide tenant isolation: stamp a `tenantId` column on
inserts/updates and filter queries to the current tenant. It exposes `MultiTenantMiddleware` (a class
with imperative methods), a `TenantContext` type, an `I MultiTenantMiddleware` interface, and free
helpers (`withTenant`, `getTenantId`, `setTenantId`, `hasTenantColumn`, `createTenantScope`).

## Current architectural problems

1. **SQL injection** — `getFilterCondition()` builds a raw `WHERE` fragment by string-interpolating
   the tenant id (`MultiTenantMiddleware.ts:103-105`), bypassing the provider's parameterization.
2. **Orphaned / unwired** — none of `applyTenant`, `getFilterCondition`, `belongsToTenant` is called
   by any ORM code path (see `_shared/task-1`). The class is not a real `OrmMiddleware`.
3. **In-place entity mutation** — `applyTenant` writes `context.entity[tenantColumn]` directly
   (line 81) with no immutability contract or change record.
4. **Mutable per-instance tenant state** (`currentTenant`, line 10) makes the middleware unsafe for
   concurrent requests; there is no request-scoped context (e.g. AsyncLocalStorage).
5. **Swallowed errors** — `getTenant()` try/catches and returns `undefined` (lines 38-43), which then
   silently produces an unfiltered query in non-strict mode (cross-tenant data leak risk).
6. **Dead/no-op helper** — `createTenantScope` (utils.ts:19-27) ignores `tenantId` and never calls
   `setTenant`; it is a misleading stub.
7. **Same-name interface vs class** and **broken ESM build** (see `_shared` tasks).

## Refactor goals

- Eliminate string-built SQL; emit parameterized predicate AST through the provider.
- Make tenant context request-scoped and explicit (no shared mutable field).
- Convert to a real, wired lifecycle/query plugin or retire (per `_shared/task-1`).
- Replace silent fallbacks with an explicit fail-closed isolation policy.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-4.md Fix SQL injection in tenant filter | P0 | Security: raw interpolation of tenant id |
| 2 | task-1.md Wire or retire (Ports & Adapters) | P0 | Methods are dead; see `_shared/task-1` |
| 3 | task-5.md Fail-closed isolation policy (no silent unfiltered queries) | P1 | Cross-tenant leak on swallowed errors |
| 4 | task-2.md Request-scoped tenant context, no shared mutable state | P1 | Concurrency-unsafe singleton state |
| 5 | task-6.md Entity mutation contract | P1 | In-place writes without change record |
| 6 | task-3.md Remove no-op `createTenantScope` / clarify helpers | P2 | Misleading dead helper |

## Dependencies on other packages

- `@ts-linq/types` (`OrmMiddleware`, `EntityChangeContext`).
- `@ts-linq/metadata` (`MetadataStorage.getEntity`).
- Would need `@ts-linq/core`/provider predicate-AST + query-filter API to emit safe SQL.

## Testing strategy

- Security unit test: tenant id containing `' OR '1'='1` must not alter the predicate.
- Concurrency test: two interleaved tenants must not see each other's filter.
- Error-path: missing tenant in strict mode throws; in lax mode the policy is explicit and tested.

## Notes

The SQL-injection finding is the only P0 that is a security defect (not just architecture); it should
be fixed regardless of the keep/retire decision if any code path can reach `getFilterCondition`.
