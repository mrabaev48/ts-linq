# ISSUE-020: Global Filters Applied at Every Terminal Operation — 12 Separate Call Sites

## Severity

Low

## Category

- Clean Code
- Maintainability

## Location

- `packages/query/src/Queryable.ts` (lines 567, 607, 641, 653, 675, 735, 763, 786, 840, 849, 858, 867, 875)

## Problem

`Queryable.applyGlobalFiltersToModel()` is called independently at **12 different terminal operation methods** (`toArray`, `count`, `first`, `single`, `any`, `paginate`, `keysetPaginate`, `sum`, `min`, `max`, `average`, `all`). Each call applies global filters to a locally-derived `queryModel` copy before executing the SQL query.

The pattern is:
```ts
// Repeated 12 times across different methods
const queryModel = this._model.clone();
this.applyGlobalFiltersToModel(queryModel);
// ... execute query with queryModel
```

This is a DRY violation. The 12 call sites will diverge over time: a developer adding a new terminal operation may forget to call `applyGlobalFiltersToModel`, producing a query that bypasses global filters (e.g., soft-delete guards) silently.

## Evidence

`grep` of `applyGlobalFiltersToModel` in `Queryable.ts` returns 12 call sites:
```
567, 607, 641, 653, 675, 735, 763, 786, 840, 849, 858, 867, 875
```

All follow the same pattern: clone the model, apply filters, execute.

## Why It Matters

- **Correctness risk**: A future terminal method that forgets `applyGlobalFiltersToModel` will silently bypass soft-delete and other global filters — a security-relevant concern in multi-tenant setups.
- **DRY violation**: 12 call sites for the same cross-cutting concern should be a single call in a shared preparation step.
- **Cognitive overhead**: A reviewer must check all 12 terminal methods individually to confirm filters are consistently applied.

## Recommended Fix

Extract a `prepareQueryModel()` private method that clones the model and applies all cross-cutting concerns (global filters, soft-delete defaults):

```ts
private prepareQueryModel(): QueryModel {
  const model = this._model.clone();
  this.applyGlobalFiltersToModel(model);
  return model;
}
```

All 12 terminal methods call `const queryModel = this.prepareQueryModel()` instead of duplicating the clone + apply pattern.

## Acceptance Criteria

- A single `prepareQueryModel()` method (or equivalent) handles model preparation for all terminal operations.
- `applyGlobalFiltersToModel` has exactly one call site (inside `prepareQueryModel`).
- Adding a new terminal operation does not require remembering to call `applyGlobalFiltersToModel`.
- Existing behavior (global filters applied to all terminal operations) is preserved.
