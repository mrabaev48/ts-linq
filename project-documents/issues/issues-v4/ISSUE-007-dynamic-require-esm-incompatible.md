# ISSUE-007: Dynamic require() in DbContext Is ESM-Incompatible and a Phantom Dependency

## Severity

High

## Category

- Build/Tooling
- Dependency Boundary
- Maintainability

## Location

- `packages/orm/src/DbContext.ts:303`
- `packages/orm/src/DbContext.ts:329`
- `packages/orm/package.json`

## Problem

`DbContext.ts` uses runtime `require()` to load `@ts-linq/metrics-safe` inside method bodies:

```ts
// line 303
const { safeCacheSize } = require('@ts-linq/metrics-safe') as { ... };

// line 329
const { safeCacheSize } = require('@ts-linq/metrics-safe') as { ... };
```

This pattern has two distinct problems:

**1. ESM incompatibility**: The project publishes ESM output (`tsconfig.esm.json`). `require()` is not available in ESM context and will throw `ReferenceError: require is not defined` at runtime in any ESM-native environment (Node.js `"type": "module"`, Deno, Bun, browser bundlers without CJS shims).

**2. Phantom dependency**: `@ts-linq/metrics-safe` does not appear in `packages/orm/package.json` dependencies:
```
deps: ['@ts-linq/core', '@ts-linq/types', '@ts-linq/metadata', '@ts-linq/query']
```
`metrics-safe` is resolved only via TypeScript path aliases in `tsconfig.json`, making it invisible to `npm`, `pnpm`, `dependency-cruiser`, and any package audit tool. Consumers of the published package will fail at runtime unless they happen to have `@ts-linq/metrics-safe` installed via another dependency.

## Evidence

- `packages/orm/src/DbContext.ts:303,329`: `require('@ts-linq/metrics-safe')`
- `packages/orm/package.json` deps: `['@ts-linq/core', '@ts-linq/types', '@ts-linq/metadata', '@ts-linq/query']` — no `metrics-safe`
- The comment context around the `require()` calls suggests this was introduced to break a circular dependency at import time — a fragile workaround

## Why It Matters

- **Runtime breakage**: Published ESM build fails with `ReferenceError` on any ESM host.
- **Hidden coupling**: `dependency-cruiser` cannot detect this dependency; CI dependency audits are blind to it.
- **Fragility**: The circular dependency workaround (`require()` inside a method) is not documented and may break if the module is lazy-loaded, bundled, or tree-shaken.
- **Maintenance**: Future maintainers will not know why `require()` was used instead of `import`.

## Recommended Fix

1. Add `@ts-linq/metrics-safe` to `packages/orm/package.json` dependencies.
2. Replace both `require()` calls with a static `import` at the top of `DbContext.ts`.
3. If the circular dependency was the reason for `require()`: resolve the actual cycle (likely that `@ts-linq/metrics-safe` or `@ts-linq/core` imports something from `@ts-linq/orm`) by extracting the shared type to `@ts-linq/types`.

## Acceptance Criteria

- `packages/orm/src/DbContext.ts` contains no `require()` calls.
- `@ts-linq/metrics-safe` is listed in `packages/orm/package.json` dependencies.
- `pnpm arch:deps` no longer reports an undeclared cross-package dependency for this path.
- The `@ts-linq/orm` package works correctly in an ESM-only environment.
