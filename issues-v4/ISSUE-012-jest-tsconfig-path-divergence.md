# ISSUE-012: Jest and TypeScript Resolve Packages from Different Locations

## Severity

High

## Category

- Build/Tooling
- Testability

## Location

- `jest.config.js` (`moduleNameMapper`, lines 35+, 71+)
- `packages/*/tsconfig.json` (`paths` pointing to `dist/`)

## Problem

There is a systematic divergence between how Jest and TypeScript resolve `@ts-linq/*` packages:

- **Jest** (`jest.config.js:71`): resolves packages to `src/` directories:
  ```js
  '^@ts-linq/types$': '<rootDir>/packages/types/src'
  '^@ts-linq/telemetry$': '<rootDir>/packages/telemetry/src'  // ← no src/ exists (ISSUE-013)
  ```

- **TypeScript** (`packages/query/tsconfig.json` and others): resolves packages to `dist/` directories:
  ```json
  "@ts-linq/metadata": ["../metadata/dist"]
  ```

This means tests and the TypeScript compiler operate on **different module graphs**:

1. Tests import `@ts-linq/core` → gets `packages/core/src/index.ts` (TypeScript source)
2. TypeScript compiler imports `@ts-linq/core` → gets `packages/core/dist/esm/index.js` (compiled output)

Consequences:
- A type change in `packages/core/src/` is immediately visible in tests without rebuilding, but `pnpm typecheck` requires `dist/` to be up-to-date.
- Tests may pass against a stale `dist/` (the compiled output used by tsc) while source is broken, or vice versa.
- `ts-jest` processing a test that imports `@ts-linq/metadata` resolves to `src/` but the tested module (compiled) resolves to `dist/` — two code paths for the same package in one test run.

## Evidence

`jest.config.js:35`:
```js
'@ts-linq/telemetry': ['packages/telemetry/src'],
```

`jest.config.js:71`:
```js
'^@ts-linq/telemetry$': '<rootDir>/packages/telemetry/src',
```

`packages/query/tsconfig.json` (representative example):
```json
"paths": {
  "@ts-linq/metadata": ["../metadata/dist"],
  "@ts-linq/core": ["../core/dist"]
}
```

## Why It Matters

- **False green CI**: Tests can pass while compiled code fails, or fail while compiled code works, depending on which path is stale.
- **Cache invalidation**: Jest does not know to rebuild `dist/` when `src/` changes; Turborepo caches are a separate system.
- **Debugging confusion**: A developer debugging a failing test may read source code, while the running code comes from a stale `dist/`.
- **Broken package reference**: `@ts-linq/telemetry` maps to a non-existent `packages/telemetry/src` (see ISSUE-013), causing test resolution errors for any test that imports it.

## Recommended Fix

Option A (preferred): Align Jest to use `dist/` paths, consistent with TypeScript:
- Update `jest.config.js` `moduleNameMapper` to point to `dist/esm/` or `dist/cjs/`.
- Add a pre-test step `pnpm build` to ensure `dist/` is current.
- Use Turborepo's `test` task (already depends on `build`) to enforce the order.

Option B: Use `ts-jest` project references mode, which resolves packages via TypeScript project references without needing pre-built `dist/`.

## Acceptance Criteria

- `jest.config.js` `moduleNameMapper` and all `packages/*/tsconfig.json` `paths` resolve the same physical files for each `@ts-linq/*` package.
- A test that imports `@ts-linq/core` runs against the same code that `pnpm typecheck` validates.
- `@ts-linq/telemetry` mapping is removed until the package is implemented (ISSUE-013).
