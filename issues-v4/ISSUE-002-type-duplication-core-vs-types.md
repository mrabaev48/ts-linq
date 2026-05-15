# ISSUE-002: Type Duplication Between @ts-linq/core and @ts-linq/types

## Severity

Critical

## Category

- Dependency Boundary
- Clean Architecture
- Maintainability

## Location

- `packages/core/src/types/index.ts`
- `packages/types/src/index.ts`

## Problem

`@ts-linq/core` defines a large set of types in `packages/core/src/types/index.ts` that partially duplicate or overlap with types in `@ts-linq/types`. The file itself acknowledges this with a comment:

```ts
// Core-specific types only - NO re-exports from other packages
// Consumers should import directly from @ts-linq/types when needed
```

Despite this disclaimer, the file contains 24 exported types and interfaces, many of which belong in the shared `@ts-linq/types` package. Examples include:

- `EntityState` — core ORM concept, should be in `@ts-linq/types`
- `TrackedEntity` — change tracking shape, used across packages
- `DbContextOptions` — configuration type for ORM context
- `QueryStartInfo`, `QueryEndInfo`, `RetryInfo`, `TransactionInfo` — logging event payloads
- `CircuitBreakerOptions`, `CircuitState`, `CircuitOpenError` — resilience types
- `FallbackInfo`, `RetryDecisionInfo` — fallback mechanism types
- `QueryPerformanceAnalysisOptions`, `QueryAnalysisInfo` — performance types

Consumers must know to import some types from `@ts-linq/types` and others from `@ts-linq/core`, but the split is not governed by a clear principle.

## Evidence

- `packages/core/src/types/index.ts`: 220 lines, 24 exported symbols
- Comment on line 1-2 acknowledges the confusion but does not enforce the boundary
- `DbContextOptions` at line 29 references `DatabaseProvider` (causing ISSUE-001)
- `QueryStartInfo`, `QueryEndInfo` at lines 119-134 are logging event types that are equally appropriate in `@ts-linq/types`

## Why It Matters

- **API instability**: Consumers cannot predict which package to import a type from; changes in either package may break their imports.
- **Divergence risk**: Both packages may evolve the same type independently, leading to incompatibility.
- **Coupling risk**: `core/src/types/index.ts` importing `DatabaseProvider` (ISSUE-001) is a direct consequence of placing a type that references a class in the wrong package.
- **Maintenance burden**: Type documentation, deprecation, and versioning must be managed in two places.

## Recommended Fix

1. Audit which types in `core/src/types/index.ts` are true infrastructure concerns (e.g., `CircuitBreakerOptions`, `CircuitState`, `CircuitOpenError`) vs. domain contracts (`EntityState`, `TrackedEntity`, `DbContextOptions`).
2. Move domain contracts to `@ts-linq/types`.
3. Keep only types tightly coupled to `@ts-linq/core` internals in `core/src/types/index.ts`.
4. Update all consumers to import from the canonical location.

## Acceptance Criteria

- `packages/core/src/types/index.ts` contains only types that directly reference `@ts-linq/core` internal classes and cannot be expressed in `@ts-linq/types`.
- `DbContextOptions` is either in `@ts-linq/types` or references a `DatabaseProvider` interface (not the class).
- No consumer package imports the same conceptual type from two different packages.
