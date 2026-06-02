---
status: not-started
phase: phase-x
package: _shared
priority: P0
effort: XL
risk: critical
category: architecture
depends_on: []
related: ["plugin-audit/task-1.md", "plugin-soft-delete/task-1.md", "plugin-multi-tenant/task-1.md"]
---

# Refactor: Decide and unify the plugin extension-point contract

## Problem

The ORM advertises an entity-lifecycle extension point that does not exist, and the three plugins
are built against it but wired to nothing. There are effectively **two parallel middleware
mechanisms**, only one of which is real:

- **Real (wired):** `DatabaseProvider` invokes `beforeExecute/afterExecute/entityMaterialized/analysis`;
  `@ts-linq/orm`'s `DbContext` has a working `SoftDeleteInterceptor` driven through `DeleteCommand`.
- **Dead (unwired):** `OrmMiddleware.beforeSave/afterSave/beforeDelete/afterDelete` hooks, and the
  three plugin classes (`AuditMiddleware`, `SoftDeleteMiddleware`, `MultiTenantMiddleware`) whose
  imperative methods nothing calls.

## Evidence

- `packages/types/src/index.ts:339-342` — `OrmMiddleware` declares `beforeSave/afterSave/beforeDelete/afterDelete`.
- Grep across `packages/**/src` (excluding tests/dist): the only `.beforeSave`/`.beforeDelete`
  *invocations* do not exist. `DatabaseProvider` (packages/core/src/DatabaseProvider.ts:686, 713, 756)
  only loops middlewares for `beforeExecute`, `afterExecute`, `entityMaterialized`, `analysis`.
- `packages/plugin-audit/src/AuditMiddleware.ts:25` `applyAudit(...)` — never called outside the plugin's own tests.
- `packages/plugin-soft-delete/src/SoftDeleteMiddleware.ts:25` `handleSoftDelete(...)` — never called; the
  real handler is `packages/orm/src/services/SoftDeleteInterceptor.ts:30` `apply(...)`, wired at
  `packages/orm/src/DbContext.ts:143,186-199` and consumed by `packages/orm/src/commands/DeleteCommand.ts:24`.
- `packages/plugin-multi-tenant/src/MultiTenantMiddleware.ts:51` `applyTenant(...)` — never called.
- No package's `package.json` lists `@ts-linq/plugin-*` as a dependency (grep over `packages/**/package.json`).
- `packages/*/src/types.ts` each declare `export interface <X>Middleware extends OrmMiddleware`
  with hooks (`beforeSave`, `beforeDelete`, ...) the corresponding class never implements
  (e.g. plugin-soft-delete/src/types.ts:43-46 vs SoftDeleteMiddleware.ts which has no `beforeDelete`).

## Why this is bad

- **Liskov / contract integrity:** an interface that promises hooks the runtime never calls is a
  false contract. Consumers who implement `beforeDelete` get silent no-ops.
- **Dead code at scale:** ~3 plugin packages of production code that the system cannot reach.
- **Duplication / divergence:** `SoftDeleteInterceptor` (orm) and `SoftDeleteMiddleware` (plugin)
  implement the same behaviour with different defaults (`isDeleted`/`deletedAt` vs the plugin's extra
  `type` and `filterDeleted`), guaranteeing inconsistent behaviour depending on which path runs.
- **Discoverability:** there is no documentation telling a plugin author which hooks fire when.

## Target architecture

Apply **Ports & Adapters (Hexagonal)** + **Dependency Inversion**:

1. Define ONE explicit, documented driven port in `@ts-linq/types` (or a new `@ts-linq/plugin-kit`):
   `EntityLifecyclePlugin` with a *minimal, honest* hook set that the ORM commits to invoking
   (`onBeforeInsert`, `onBeforeUpdate`, `onBeforeDelete` returning a typed `DeleteDecision`).
2. The ORM's change-tracking / `SaveChanges` pipeline (the real driver, not `DatabaseProvider`'s
   SQL layer) becomes the single **Chain of Responsibility** that runs registered plugins in order.
3. Each plugin becomes a thin **Adapter** implementing the port; its bespoke `apply*` methods either
   move behind the port or are deleted.
4. `OrmMiddleware`'s lifecycle hooks are either implemented by this driver or removed from the type
   (breaking change → changeset `major` + migration note).

Alternative (if plugins are deemed not worth reviving): **formally retire** all three plugin packages
and the lifecycle hooks; keep the orm-internal interceptors as the only mechanism. This is a valid
P0 outcome and must be an explicit, documented decision.

## Proposed refactor

1. Write an ADR (`project-documents/...`) recording: keep-and-wire vs retire. Recommended: keep
   soft-delete behaviour in orm interceptors; convert audit + multi-tenant to real lifecycle plugins;
   delete the orphaned `SoftDeleteMiddleware` class in favour of the orm interceptor.
2. If keeping: define the port, implement the driver in the SaveChanges pipeline, add a registration
   API on `DbContext`/provider config, and rewrite each plugin class as an adapter.
3. If retiring: remove the three plugin packages from the workspace, remove lifecycle hooks from
   `OrmMiddleware`, add changeset + migration docs.
4. Update every plugin's per-package `task-1.md` to point at the resolved decision.

## Suggested design patterns

- **Ports & Adapters** — one driven port the ORM owns; plugins are adapters. Removes coupling to
  plugin internals and makes hooks discoverable in one place.
- **Chain of Responsibility** — ordered plugin execution with explicit short-circuit for soft-delete
  ("I handled the delete").
- **Strategy / Policy object** — per-plugin behaviour selected behind the port.
- **Null Object** — a no-op default plugin so the driver never branches on `undefined`.

## Testing plan

- **Contract test suite** run against every adapter, asserting each declared hook actually fires
  from the real driver with the documented context.
- **Integration test** in `@ts-linq/orm`: register audit + tenant plugins, run `SaveChanges`, assert
  columns are populated and delete short-circuits to soft-delete.
- **Error-path:** a plugin throwing in `onBeforeDelete` must surface, not be swallowed.
- **Regression:** existing `SoftDeleteInterceptor` behaviour preserved.

## Acceptance criteria

- [ ] An ADR records the keep-vs-retire decision with rationale.
- [ ] There is exactly one wired mechanism for entity-lifecycle behaviour.
- [ ] No exported interface declares a hook the runtime never calls.
- [ ] No `<X>Middleware` class exposes public methods unreachable from the ORM.
- [ ] `OrmMiddleware` lifecycle hooks are either driven or removed (with changeset + migration note).
- [ ] Contract tests pass against all surviving adapters.

## Refactor order

1. ADR / decision. 2. Port definition. 3. Driver in SaveChanges pipeline. 4. Adapter rewrites or
package removal. 5. Type cleanup + changeset. 6. Contract tests.

## Notes

This is the keystone task for cluster C7. Per-package P1 tasks (entity mutation, raw SQL, error
handling) should be scheduled *after* the keep/retire decision, since "retire" makes several of them
moot.
