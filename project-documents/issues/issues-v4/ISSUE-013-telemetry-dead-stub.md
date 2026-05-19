# ISSUE-013: @ts-linq/telemetry Package Is a Dead Stub

## Severity

High

## Category

- Build/Tooling
- Maintainability
- Documentation Drift

## Location

- `packages/telemetry/` (entire package)
- `jest.config.js:35, 71` (references non-existent `packages/telemetry/src`)

## Problem

The `@ts-linq/telemetry` package exists in the monorepo with only build configuration files — **no `src/` directory and no implementation**:

```
packages/telemetry/
  dist/          (from a previous build or placeholder)
  node_modules/
  package.json
  tsconfig.esm.json
  tsconfig.json
  tsconfig.tsbuildinfo
```

There is no `index.ts`, no `src/` directory, and no exports. Despite this, `jest.config.js` references the package in two places:

```js
// jest.config.js:35 (ts-jest moduleNameMapper)
'@ts-linq/telemetry': ['packages/telemetry/src'],

// jest.config.js:71 (moduleNameMapper)
'^@ts-linq/telemetry$': '<rootDir>/packages/telemetry/src',
```

Both references point to `packages/telemetry/src` which does not exist. Any test that imports `@ts-linq/telemetry` (directly or transitively) will fail with a module resolution error at runtime.

## Evidence

- `ls packages/telemetry/` output: `dist node_modules package.json tsconfig.esm.json tsconfig.json tsconfig.tsbuildinfo` — no `src/` directory
- `jest.config.js:35`: maps `@ts-linq/telemetry` → `packages/telemetry/src` (non-existent)
- `jest.config.js:71`: same mapping in `moduleNameMapper`
- `packages/telemetry/package.json` likely references a `dist/index.js` main entry that is either empty or stale

## Why It Matters

- **Runtime test failures**: Any import of `@ts-linq/telemetry` in tests causes an immediate module resolution failure.
- **False safety**: The package appears in `pnpm-workspace.yaml` and turbo pipeline, consuming build and typecheck resources for zero output.
- **Misleading architecture**: The package name implies OpenTelemetry integration is available, but no consumer can actually use it.
- **Build noise**: `tsconfig.tsbuildinfo` exists, suggesting the build system has attempted to compile this package, producing undefined behavior.

## Recommended Fix

**Option A (recommended)**: Implement `@ts-linq/telemetry`:
1. Create `packages/telemetry/src/index.ts` wrapping OpenTelemetry SDK.
2. Export a `TelemetryProvider` compatible with the `@ts-linq/open-telemetry-sql-logger` package.
3. Implement the `logger` interface from `@ts-linq/types`.

**Option B**: Remove the stub:
1. Delete `packages/telemetry/` entirely.
2. Remove the `@ts-linq/telemetry` entry from `jest.config.js` (both locations).
3. Remove from `pnpm-workspace.yaml` if present.
4. Update `turbo.json` if the package is referenced in the pipeline.

## Acceptance Criteria

- `packages/telemetry/src/index.ts` exists and exports at least one symbol (or the package is removed).
- `jest.config.js` `moduleNameMapper` does not reference a non-existent directory.
- `pnpm test` does not fail with a module resolution error for `@ts-linq/telemetry`.
