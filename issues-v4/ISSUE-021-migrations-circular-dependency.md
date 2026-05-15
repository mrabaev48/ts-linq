# ISSUE-021: Circular Dependencies in @ts-linq/migrations

## Severity

Critical

## Category

- Dependency Boundary
- Clean Architecture

## Location

- `packages/migrations/src/comparators/ColumnComparator.ts`
- `packages/migrations/src/comparators/IndexComparator.ts`
- `packages/migrations/src/DiffTypes.ts`

## Problem

`dependency-cruiser` (`pnpm arch:deps`) reports two circular dependency errors in `@ts-linq/migrations`:

```
ColumnComparator.ts → DiffTypes.ts → ColumnComparator.ts
IndexComparator.ts  → DiffTypes.ts → IndexComparator.ts
```

These are intra-package cycles (within `@ts-linq/migrations`). `DiffTypes.ts` imports types from the comparator files — the files that are supposed to consume `DiffTypes.ts`. This is an inversion of the expected data-flow:

- **Expected**: `DiffTypes.ts` defines shapes; comparators import shapes and produce diffs.
- **Actual**: `DiffTypes.ts` imports from comparators, closing the cycle.

## Evidence

`pnpm arch:deps:json` (dependency-cruiser) output — rule `no-circular` (severity: **error**):
```
packages/migrations/src/comparators/ColumnComparator.ts
  → packages/migrations/src/DiffTypes.ts
    → packages/migrations/src/comparators/ColumnComparator.ts

packages/migrations/src/comparators/IndexComparator.ts
  → packages/migrations/src/DiffTypes.ts
    → packages/migrations/src/comparators/IndexComparator.ts
```

This finding was **not detected by madge** (`pnpm arch:cycles`), which only found the core package cycle. Dependency-cruiser caught these additional cycles.

## Why It Matters

- **Build correctness**: TypeScript compiler may produce non-deterministic output ordering for circular imports, especially in composite project mode.
- **Maintenance**: Any change to `ColumnComparator` may require simultaneous changes to `DiffTypes.ts`, and vice versa — the two modules cannot be understood independently.
- **Testability**: Testing `ColumnComparator` in isolation requires loading `DiffTypes.ts`, which requires loading `ColumnComparator` — circular bootstrapping in test environments.

## Recommended Fix

Break the cycle by ensuring `DiffTypes.ts` contains only pure type/interface declarations with no imports from comparators:

1. Move any type definitions currently in `DiffTypes.ts` that reference comparator types back into the comparators themselves, or into a separate `DiffShapes.ts` with zero dependencies.
2. `DiffTypes.ts` should only import from `@ts-linq/types` or external libraries — never from sibling comparator files.
3. Comparators import from `DiffTypes.ts` (one-way dependency).

## Acceptance Criteria

- `pnpm arch:cycles` and `pnpm arch:deps` report zero circular dependencies in `packages/migrations/`.
- `DiffTypes.ts` imports no file from `packages/migrations/src/comparators/`.
- `ColumnComparator.ts` and `IndexComparator.ts` are independently loadable without circular bootstrapping.
