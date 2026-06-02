---
status: not-started
phase: phase-x
package: plugin-audit
priority: P0
effort: L
risk: high
category: architecture
depends_on: ["_shared/task-1.md"]
related: ["plugin-soft-delete/task-1.md", "plugin-multi-tenant/task-1.md"]
---

# Refactor: Wire AuditMiddleware to a real lifecycle port or retire it

## Problem

`AuditMiddleware.applyAudit` is the only behavioural method and nothing in the ORM calls it. The class
is presented as middleware but is not wired to any execution path, and the same-named interface
promises hooks the class never implements.

## Evidence

- `packages/plugin-audit/src/AuditMiddleware.ts:8` — `class AuditMiddleware` (no `implements OrmMiddleware`).
- `applyAudit` (line 25) — no caller outside the package's tests (grep over `packages/**/src`).
- `packages/plugin-audit/src/types.ts:73-76` — `interface AuditMiddleware extends OrmMiddleware
  { beforeSave?; afterSave?; }` — class has no `beforeSave`/`afterSave`; re-exported as
  `IAuditMiddleware` (`index.ts:8`).
- No package depends on `@ts-linq/plugin-audit`.
- The runtime only invokes `beforeExecute/afterExecute/entityMaterialized/analysis`
  (`packages/core/src/DatabaseProvider.ts:686,713,756`); audit needs an *entity-lifecycle* hook
  (`beforeSave`/before-insert/before-update) that the runtime never drives (`_shared/task-1`).

## Why this is bad

- Dead public API: consumers wiring this into a provider get audit columns that are never stamped.
- The interface is a false contract (Liskov): `beforeSave` declared, never honoured.
- Unlike soft-delete, there is **no** in-tree replacement — so audit functionality is effectively
  missing from the ORM today.

## Target architecture

Per `_shared/task-1` (Ports & Adapters): a real `EntityLifecyclePlugin` port driven by the orm
SaveChanges pipeline. `AuditMiddleware` becomes a thin **Adapter** implementing
`onBeforeInsert`/`onBeforeUpdate`, delegating to the existing `applyCreatedAudit`/`applyUpdatedAudit`
(which are already well-factored, `AuditMiddleware.ts:50-87`).

If retiring: document audit as a recipe over change-tracker hooks, or fold into orm — but do not leave
a dead package implying the feature exists.

## Proposed refactor

1. Resolve `_shared/task-1`.
2. If keeping: implement the lifecycle port; register audit on the SaveChanges chain; map
   `onBeforeInsert → applyCreatedAudit`, `onBeforeUpdate/onBeforeInsert → applyUpdatedAudit`.
3. Remove the same-name interface; export one coherent type.
4. If retiring: remove package + add changeset/migration.

## Suggested design patterns

- **Ports & Adapters**, **Strategy** (created vs updated stamping), **Null Object** (no current user).

## Testing plan

- Contract test: registering audit stamps `createdAt`/`updatedAt`/`createdBy`/`updatedBy` on real
  insert/update through the orm pipeline.
- Negative: declared hooks actually fire.

## Acceptance criteria

- [ ] `applyAudit` (or its successor) is reachable from a real ORM code path, or the package is removed.
- [ ] No interface declares a hook the implementation/runtime never honours.
- [ ] Same-name interface/class collision resolved.
- [ ] Contract test demonstrates audit columns are stamped end-to-end.

## Refactor order

1. `_shared/task-1`. 2. Lifecycle port + adapter. 3. Type cleanup. 4. Contract tests.

## Notes

Strongest "keep and wire" candidate of the three plugins (no existing replacement).
