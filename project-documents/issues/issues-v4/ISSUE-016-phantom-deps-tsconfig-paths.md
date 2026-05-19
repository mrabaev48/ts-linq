# ISSUE-016: Phantom Dependencies via TypeScript Path Aliases

## Severity

Medium

## Category

- Dependency Boundary
- Build/Tooling

## Location

- `packages/orm/src/DbContext.ts` (uses `@ts-linq/metrics-safe` without declaring it)
- `packages/orm/package.json` (missing `@ts-linq/metrics-safe` in dependencies)
- All `packages/*/tsconfig.json` (path aliases that may mask undeclared deps)

## Problem

TypeScript `paths` in `tsconfig.json` map module names to file system locations at compile time. However, these mappings are **invisible to package managers (npm/pnpm)**, `dependency-cruiser`, and security audit tools. A package can successfully compile and even pass tests while depending on a module that is not declared in its `package.json`.

The concrete instance is `@ts-linq/orm` depending on `@ts-linq/metrics-safe`:
- `packages/orm/src/DbContext.ts:303,329`: `require('@ts-linq/metrics-safe')`
- `packages/orm/package.json` deps: `['@ts-linq/core', '@ts-linq/types', '@ts-linq/metadata', '@ts-linq/query']` — **`@ts-linq/metrics-safe` is absent**

TypeScript resolves the import via the path alias in `packages/orm/tsconfig.json` (which points to `../metrics-safe/dist`). The code compiles and tests pass in the monorepo context where `metrics-safe` is always present. But consumers who install `@ts-linq/orm` from npm will not get `@ts-linq/metrics-safe` as a transitive dependency, causing a runtime failure.

The same risk exists for any other `@ts-linq/*` package that has a path alias in `tsconfig.json` but is not listed in `package.json`.

## Evidence

`packages/orm/src/DbContext.ts:303`:
```ts
const { safeCacheSize } = require('@ts-linq/metrics-safe') as { ... };
```

`packages/orm/package.json` dependencies:
```
['@ts-linq/core', '@ts-linq/types', '@ts-linq/metadata', '@ts-linq/query']
```
`@ts-linq/metrics-safe` is not listed.

## Why It Matters

- **Consumer breakage**: Published `@ts-linq/orm` consumers get a runtime error for a missing package that was never in the dependency graph.
- **Security audit blind spot**: `npm audit` and `pnpm audit` only check declared dependencies; phantom deps are invisible.
- **Monorepo false confidence**: All packages are co-present in the monorepo, masking the missing declaration throughout local development.
- **CI false positive**: The monorepo's `pnpm install` makes all packages available, so the missing dependency is never caught by install-time checks.

## Recommended Fix

1. **Immediate**: Add `@ts-linq/metrics-safe` to `packages/orm/package.json` dependencies (also fixes ISSUE-007).
2. **Systemic**: Add a CI lint step that verifies every `@ts-linq/*` path alias in each package's `tsconfig.json` is also declared in the package's `package.json`:
   ```bash
   # pseudo-code
   for each package:
     for each path alias starting with "@ts-linq/":
       assert alias is in package.json dependencies or devDependencies
   ```
3. Enable `dependency-cruiser` rule `no-extraneous-dependencies` to catch this class of issue automatically.

## Acceptance Criteria

- Every `@ts-linq/*` path alias in a package's `tsconfig.json` corresponds to a declared dependency in that package's `package.json`.
- `dependency-cruiser` is configured to catch undeclared cross-package imports.
- CI fails if a new phantom dependency is introduced.
