# ISSUE-015: Per-Package tsconfig.json Path Aliases Are Duplicated Across 21+ Packages

## Severity

Medium

## Category

- Build/Tooling
- Maintainability

## Location

- `tsconfig.base.json` (missing `paths` section)
- All `packages/*/tsconfig.json` files (~21+ packages)

## Problem

Each package in the monorepo independently re-declares path aliases for all its `@ts-linq/*` dependencies in its own `tsconfig.json`. For example, `packages/query/tsconfig.json` contains:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@ts-linq/types": ["../types/dist"],
      "@ts-linq/metadata": ["../metadata/dist"],
      "@ts-linq/core": ["../core/dist"],
      "@ts-linq/ast": ["../ast/dist"],
      "@ts-linq/metrics-safe": ["../metrics-safe/dist"]
    }
  }
}
```

This pattern is repeated in 21+ package-level `tsconfig.json` files. The root `tsconfig.base.json` does not define a shared `paths` map.

Consequences:
- **Maintenance burden**: When a package is renamed, moved, or its output directory changes, every dependent package's `tsconfig.json` must be updated manually.
- **Inconsistency risk**: Different packages may define slightly different path mappings for the same target (e.g., `dist/esm` vs `dist/cjs` vs `dist`), causing silent resolution differences.
- **Toil**: Adding a new shared package (`@ts-linq/sql-visitor` once implemented) requires updating all 21+ `tsconfig.json` files.

## Evidence

`packages/query/tsconfig.json` — independent paths for 5 packages.
`packages/orm/tsconfig.json` — independent paths for 4 packages.

Pattern repeated in: `core`, `query`, `orm`, `dialect-*`, `provider-*`, `migrations`, `cli`, `cache`, `cache-redis`, `cache-memcached`, `plugin-*`, `integration-nestjs`, `pagination`, `concurrency`.

Root `tsconfig.base.json` contains no `paths` section.

## Why It Matters

- **Scalability**: The monorepo currently has 34 packages; as it grows, the duplication scales linearly.
- **Error-proneness**: A typo in one package's path alias causes silent resolution failure that may not surface until runtime.
- **Review friction**: PRs adding a new shared package require 21+ `tsconfig.json` file changes.

## Recommended Fix

Define all `@ts-linq/*` path aliases once in `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@ts-linq/types": ["packages/types/dist"],
      "@ts-linq/metadata": ["packages/metadata/dist"],
      "@ts-linq/core": ["packages/core/dist"],
      "@ts-linq/ast": ["packages/ast/dist"],
      "@ts-linq/query": ["packages/query/dist"],
      "@ts-linq/orm": ["packages/orm/dist"],
      "@ts-linq/metrics-safe": ["packages/metrics-safe/dist"]
    }
  }
}
```

Note: paths in `tsconfig.base.json` should be relative to the workspace root. Each per-package `tsconfig.json` keeps only its own `baseUrl` and extends the base without redefining `paths`.

## Acceptance Criteria

- `tsconfig.base.json` contains a canonical `paths` map for all `@ts-linq/*` packages.
- All per-package `tsconfig.json` files define no `paths` section (or only package-local aliases not applicable to the base).
- Adding a new `@ts-linq/*` package requires updating only `tsconfig.base.json` and `jest.config.js`.
