# ISSUE-012: `PrometheusEndpoint` in `@ts-linq/core`

## Severity

Medium

## Category

- Clean Architecture
- Dependency Boundary
- SOLID

## Location

- `packages/core/src/utils/PrometheusEndpoint.ts`
- `packages/core/src/index.ts:74` — `export * from './utils/PrometheusEndpoint'`

## Problem

`@ts-linq/core` exports a `PrometheusEndpoint` utility that starts an HTTP server to expose Prometheus metrics. This is an infrastructure concern — it depends on Node.js `http` module and a specific observability standard — embedded inside the core domain package.

`@ts-linq/core` is responsible for: entity decorators, loading strategies, provider abstractions, and shared domain utilities. It should have no knowledge of HTTP servers, metrics exposition formats, or observability frameworks.

## Evidence

```typescript
// packages/core/src/index.ts
export * from './utils/PrometheusEndpoint';
```

The existence of `PrometheusEndpoint` in `core` means:
- Any consumer of `@ts-linq/core` (all dialects, the query layer, the ORM layer) implicitly bundles HTTP server code
- The core package is aware of a specific observability standard (Prometheus), violating open-closed principle for new observability formats
- Tree-shaking may not eliminate this if it has side effects (e.g., module-level listener setup)

A separate `@ts-linq/prometheus-sql-logger` package already exists in the monorepo, which is the correct home for Prometheus-related code. The `PrometheusEndpoint` utility should live there, not in `core`.

## Why It Matters

- **Dependency boundary**: The core layer should not depend on or expose HTTP server infrastructure.
- **Bundle size risk**: Consumers using `@ts-linq/core` in non-Node.js environments (e.g., edge runtimes, browser-side tooling) would encounter Node.js `http` module imports.
- **SRP violation**: Adding or changing Prometheus exposition format requires modifying the core package.
- **Coupling risk**: `@ts-linq/telemetry` and `@ts-linq/prometheus-sql-logger` are the correct packages for this. Duplicating the concern in `core` creates two places to maintain HTTP/metrics logic.

## Recommended Fix

1. Move `PrometheusEndpoint` to `@ts-linq/prometheus-sql-logger` or `@ts-linq/telemetry`
2. Remove the export from `packages/core/src/index.ts`
3. Add a re-export from `@ts-linq/prometheus-sql-logger` for backward compatibility with a `@deprecated` JSDoc notice
4. Update any internal usage within `core` itself (if any) to import from the new location

## Acceptance Criteria

- `packages/core/src/utils/PrometheusEndpoint.ts` is removed or moved
- `packages/core/src/index.ts` no longer exports `PrometheusEndpoint`
- `PrometheusEndpoint` is available from a metrics/telemetry package
- `@ts-linq/core` has no dependency on Node.js `http` module at the top level
