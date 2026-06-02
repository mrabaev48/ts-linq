---
status: not-started
phase: phase-x
package: plugin-multi-tenant
priority: P0
effort: L
risk: high
category: architecture
depends_on: ["_shared/task-1.md"]
related: ["plugin-audit/task-1.md", "plugin-soft-delete/task-1.md"]
---

# Refactor: Wire MultiTenantMiddleware to a real extension point or retire it

## Problem

`MultiTenantMiddleware` exposes imperative methods (`applyTenant`, `getFilterCondition`,
`belongsToTenant`, `setTenant`, `clearTenant`) that no ORM code path invokes, and it claims to be an
`OrmMiddleware` via a same-named interface whose hooks the class never implements.

## Evidence

- `packages/plugin-multi-tenant/src/MultiTenantMiddleware.ts:8` — `class MultiTenantMiddleware`
  (no `implements OrmMiddleware`).
- `packages/plugin-multi-tenant/src/types.ts:44-47` — `interface MultiTenantMiddleware extends
  OrmMiddleware { beforeQuery?; beforeSave?; }` — declares hooks the class lacks; re-exported as
  `IMultiTenantMiddleware` (`index.ts:9`).
- `applyTenant` (line 51) and `getFilterCondition` (line 88) have no callers outside the package's
  tests (grep over `packages/**/src`).
- No package depends on `@ts-linq/plugin-multi-tenant`.
- `beforeQuery` is not even a member of the core `OrmMiddleware` (`@ts-linq/types` defines
  `beforeExecute/afterExecute/entityMaterialized/analysis/beforeSave/afterSave/beforeDelete/afterDelete`)
  — so `TenantContext.beforeQuery` is doubly fictional.

## Why this is bad

- Dead public API; tenant isolation appears available but does nothing when wired into a provider.
- The interface promises `beforeQuery`/`beforeSave` that neither the class nor the runtime honours
  (Liskov / contract violation).
- Multi-tenancy is a *query-filtering* concern; the real ORM has no query-time middleware hook, so
  this plugin cannot work without a new port.

## Target architecture

Per `_shared/task-1` (Ports & Adapters). For multi-tenancy specifically, the needed port is a
**query-filter contributor** (the ORM already has `GlobalFilter`/query-filter machinery). The plugin
becomes a **Policy object** that supplies a tenant predicate to that mechanism, plus a lifecycle
adapter (`onBeforeInsert/onBeforeUpdate`) for column stamping.

If retiring: tenant column stamping + global filter could instead be a documented recipe over the
existing `GlobalFilter` API, and the package is removed.

## Proposed refactor

1. Resolve `_shared/task-1` decision for multi-tenancy.
2. If keeping: implement the query-filter port; register the tenant predicate (from task-4's safe
   predicate) via the existing global-filter pipeline; implement lifecycle stamping behind the port.
3. Remove the fictional `beforeQuery` and the same-name interface; export a single coherent type.
4. If retiring: delete the package, add a `GlobalFilter`-based recipe to docs.

## Suggested design patterns

- **Ports & Adapters**, **Policy object** (tenant predicate), **Strategy** (per-tenant resolution).

## Testing plan

- Contract test: registering the plugin actually injects the tenant predicate into emitted queries.
- Integration: insert stamps `tenantId`; query filters to current tenant.
- Negative: hooks that exist on the type actually fire.

## Acceptance criteria

- [ ] No public method/hook is unreachable from the ORM.
- [ ] `beforeQuery` and any non-existent hook removed.
- [ ] Same-name interface/class collision resolved.
- [ ] Tenant filtering demonstrably applied through the real query pipeline (or package removed).

## Refactor order

1. `_shared/task-1`. 2. Query-filter port. 3. Adapter. 4. Type cleanup. 5. Tests.

## Notes

Tightly coupled to `task-4` (safe predicate) and `_shared/task-1` (the port).
