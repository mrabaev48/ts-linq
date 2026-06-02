---
status: not-started
phase: phase-x
package: _shared
priority: P2
effort: M
risk: medium
category: typescript
depends_on: ["_shared/task-1.md"]
related: ["plugin-soft-delete/task-1.md"]
---

# Refactor: Consolidate duplicated `SoftDeleteOptions` and divergent config types

## Problem

The concept "soft delete configuration" is defined twice, with different fields, in two packages.
Whichever code path runs determines which option shape and defaults apply, producing inconsistent
behaviour.

## Evidence

- `packages/types/src/index.ts:382-389` — `SoftDeleteOptions { enabled?, column?, columnName?,
  deletedAtColumn?, type? }` (note both `column` AND `columnName`).
- `packages/plugin-soft-delete/src/types.ts:6-31` — a *different* `SoftDeleteOptions
  { enabled?, column?, deletedAtColumn?, type?, filterDeleted? }` (adds `filterDeleted`, lacks
  `columnName`).
- The wired orm interceptor consumes the `@ts-linq/types` version
  (`packages/orm/src/services/SoftDeleteInterceptor.ts:6,24,38-39`), defaulting `column ?? 'isDeleted'`,
  `deletedAtColumn ?? 'deletedAt'` — it ignores `filterDeleted` and `type` entirely.
- The plugin defaults differently in its constructor (`SoftDeleteMiddleware.ts:12-19`,
  `type: 'boolean'`, `filterDeleted: true`).

## Why this is bad

- **Single Source of Truth violation:** two types named `SoftDeleteOptions`, importable from two
  packages, silently incompatible.
- **Behavioural divergence:** `type: 'timestamp'` and `filterDeleted` exist only in the plugin, so a
  consumer configuring them gets different behaviour through the real orm path (which ignores them).
- `columnName` in the types version appears to be a legacy alias never read by the interceptor
  (`SoftDeleteInterceptor` reads `column`, not `columnName`) — dead field.

## Target architecture

One canonical `SoftDeleteOptions` in `@ts-linq/types`, owning every documented field, consumed by the
single surviving soft-delete implementation (per `_shared/task-1`). Remove dead aliases. Apply
**Single Source of Truth** and **Interface Segregation** (separate query-filtering options from
mutation options if both survive).

## Proposed refactor

1. Decide the canonical field set (likely: `enabled`, `column`, `deletedAtColumn`, `type`,
   `filterDeleted`) and move it to `@ts-linq/types`.
2. Delete the plugin-local `SoftDeleteOptions`; re-export the canonical one if the plugin survives.
3. Implement (or explicitly document as unsupported) `type: 'timestamp'` and `filterDeleted` in the
   surviving interceptor so the type does not promise unimplemented behaviour.
4. Remove the unused `columnName` field or wire it as a real alias with tests.
5. Changeset (`minor`/`major` depending on field removals).

## Suggested design patterns

- **Single Source of Truth**, **Interface Segregation** (split mutation vs query-filter concerns).

## Testing plan

- Type-level test: only one `SoftDeleteOptions` is exported from the public surface.
- Behaviour tests for `type: 'boolean'` vs `'timestamp'` and `filterDeleted` on/off against the real path.
- Regression for the existing interceptor defaults.

## Acceptance criteria

- [ ] Exactly one `SoftDeleteOptions` type in the monorepo.
- [ ] Every field is actually read by the surviving implementation (no dead `columnName`).
- [ ] `type` and `filterDeleted` are implemented or explicitly removed from the type.
- [ ] Changeset added.

## Refactor order

1. Decide canonical shape. 2. Move to types. 3. Reconcile implementation. 4. Remove dead fields.
5. Tests + changeset.

## Notes

Depends on `_shared/task-1` because the surviving implementation determines which fields must be honoured.
