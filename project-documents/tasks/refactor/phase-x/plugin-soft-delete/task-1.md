---
status: not-started
phase: phase-x
package: plugin-soft-delete
priority: P0
effort: L
risk: high
category: architecture
depends_on: ["_shared/task-1.md"]
related: ["_shared/task-5.md", "plugin-audit/task-1.md", "plugin-multi-tenant/task-1.md"]
---

# Refactor: Retire or fold the soft-delete plugin into the orm interceptor

## Problem

Soft delete is implemented twice. One copy is wired and works (`SoftDeleteInterceptor` in
`@ts-linq/orm`); the other (`SoftDeleteMiddleware` in this plugin) is orphaned and divergent. Two
implementations of the same feature is the worst-case duplication: behaviour depends on which path a
consumer happens to hit.

## Evidence

- **Wired implementation:** `packages/orm/src/services/SoftDeleteInterceptor.ts:22-54`
  (`apply(change)`), constructed in `packages/orm/src/DbContext.ts:186-199` and invoked via
  `packages/orm/src/commands/DeleteCommand.ts:24` (`await this.handleSoftDelete(change)`).
- **Orphaned duplicate:** `packages/plugin-soft-delete/src/SoftDeleteMiddleware.ts:25` `handleSoftDelete`
  — no caller outside the package's own tests; no package depends on `@ts-linq/plugin-soft-delete`.
- **Behavioural divergence:**
  - Interceptor unconditionally sets `flag = true` (SoftDeleteInterceptor.ts:44) and executes an UPDATE.
  - Plugin sets flag/timestamp but never executes — it only mutates and returns `true`
    (SoftDeleteMiddleware.ts:51-59), relying on a caller that does not exist.
  - Plugin supports `restore` (lines 60-68) and `type: 'timestamp'`/`filterDeleted`; interceptor does not.
- **Type divergence:** `_shared/task-5` (two `SoftDeleteOptions`).

## Why this is bad

- **DRY at the worst scale:** an entire feature duplicated with subtly different semantics.
- A consumer reaching for `@ts-linq/plugin-soft-delete` gets a class that mutates entities but never
  persists, because its execution callback is never supplied.
- Maintenance forks: a bug fix to soft delete must be applied in two divergent places.

## Target architecture

Single soft-delete implementation. Recommended: **keep the orm `SoftDeleteInterceptor`** (it is the
wired, persisting one) and **retire `SoftDeleteMiddleware`**, migrating any genuinely-missing
capabilities (restore, timestamp mode, query filtering) *into* the interceptor under the canonical
`SoftDeleteOptions`. Apply **Single Responsibility** (one owner of soft-delete behaviour) and
**Single Source of Truth**.

If `_shared/task-1` instead chooses the plugin model, the orm interceptor becomes the adapter — but
two parallel copies must not survive either way.

## Proposed refactor

1. Inventory plugin-only capabilities not in the interceptor: `restore`, `type: 'timestamp'`,
   `filterDeleted`/query filtering, `isSoftDeleted`.
2. Port the worthwhile ones into `SoftDeleteInterceptor` (or its query-filter sibling) under the
   canonical option type from `_shared/task-5`.
3. Delete the plugin package (or reduce it to a thin re-export of the orm capability if a public
   package name must be preserved).
4. Add changeset (`major` — removes a public package surface) + migration note.

## Suggested design patterns

- **Single Responsibility / Single Source of Truth**, **Strategy** (boolean vs timestamp mode inside
  one interceptor), **Ports & Adapters** if `_shared/task-1` keeps the plugin model.

## Testing plan

- Regression: existing `SoftDeleteInterceptor` behaviour preserved.
- New: restore + timestamp mode + query filtering tested against the surviving implementation.
- Confirm no consumer imports the removed package.

## Acceptance criteria

- [ ] Exactly one soft-delete implementation in the monorepo.
- [ ] Plugin-only capabilities ported or explicitly dropped with rationale.
- [ ] `SoftDeleteMiddleware` (the unwired, non-persisting copy) removed.
- [ ] Changeset + migration note added.

## Refactor order

1. Capability inventory. 2. Port into interceptor. 3. Remove plugin. 4. Changeset/migration.

## Notes

This is the cleanest retire candidate in cluster C7. Coordinate with `_shared/task-1` and `_shared/task-5`.
