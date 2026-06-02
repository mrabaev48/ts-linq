# Refactor Audit: plugin-audit

## Package responsibility

`@ts-linq/plugin-audit` is meant to stamp audit columns (`createdAt`/`updatedAt`/`createdBy`/
`updatedBy`) on inserts and updates. It exposes `AuditMiddleware` (imperative `applyAudit`), an
`AuditContext`/`AuditOptions` pair, an `IAuditMiddleware` interface, and read helpers
(`getAuditInfo`, `hasBeenModified`, `timeSinceUpdate`, `withAudit`).

## Current architectural problems

1. **Orphaned / unwired:** `applyAudit` is called by nothing outside the package's tests; no package
   depends on `@ts-linq/plugin-audit`. The class is not a real wired `OrmMiddleware`
   (see `_shared/task-1`).
2. **Same-name interface vs class:** `types.ts` declares `interface AuditMiddleware extends
   OrmMiddleware` with `beforeSave/afterSave` hooks the class never implements
   (`types.ts:73-76`), re-exported as `IAuditMiddleware`.
3. **`AuditContext` duplicates `EntityChangeContext`** with a divergent `state` union, instead of
   reusing the shared type (`types.ts:62-68` vs `@ts-linq/types:323-328`).
4. **Swallowed errors:** `getCurrentUserId` bare-catches resolver failures and returns `undefined`
   (`AuditMiddleware.ts:109-113`), silently dropping the `createdBy`/`updatedBy` stamp.
5. **In-place entity mutation** with no contract (`AuditMiddleware.ts:60-65,82-85`).
6. **Confusing dual option model:** flat `createdAtColumn` etc. AND nested `timeColumns`/`userColumns`
   with the nested form silently overriding (`AuditMiddleware.ts:56-57,77-78`).
7. **Broken ESM build**, **dead `tests-new/`** (see `_shared`).

## Refactor goals

- Wire to a real lifecycle port or retire (per `_shared/task-1`).
- Reuse `EntityChangeContext`; drop the duplicate `AuditContext`/interface collision.
- Make user resolution failures explicit, not swallowed.
- Collapse the dual option model to one coherent shape.
- Give entity mutation an explicit contract.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md Wire to lifecycle port or retire | P0 | `applyAudit` is dead; see `_shared/task-1` |
| 2 | task-2.md Stop swallowing user-resolution errors | P1 | Silent loss of audit-by data |
| 3 | task-5.md Reuse `EntityChangeContext`; remove interface/class name collision | P1 | Type duplication + false contract |
| 4 | task-4.md Entity mutation contract | P1 | In-place writes without contract |
| 5 | task-3.md Collapse dual flat/nested option model | P2 | Two overlapping config shapes |

## Dependencies on other packages

- `@ts-linq/types` (`OrmMiddleware`, `EntityChangeContext`).
- `@ts-linq/metadata` (`MetadataStorage.getEntity`).
- A real lifecycle driver (orm SaveChanges pipeline) for wiring.

## Testing strategy

- Contract test: when wired, `applyAudit`/hooks actually fire on insert/update.
- Error-path: resolver throwing surfaces (not swallowed silently).
- Option-precedence tests for the (collapsed) option model.
- Mutation contract tests.

## Notes

Audit is the most plausible "keep and wire" candidate (no in-tree replacement exists, unlike
soft-delete). The dual option model and the swallowed resolver are the highest-value cleanups.
