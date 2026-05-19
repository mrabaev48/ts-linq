# ISSUE-001: Circular Dependency in @ts-linq/core

## Severity

Critical

## Category

- Dependency Boundary
- Clean Architecture

## Location

- `packages/core/src/DatabaseProvider.ts`
- `packages/core/src/Health/HealthMonitor.ts`
- `packages/core/src/Resilience/ResilienceManager.ts`
- `packages/core/src/types/index.ts`

## Problem

There is a circular dependency chain within `@ts-linq/core`:

```
DatabaseProvider.ts
  → Health/HealthMonitor.ts
    → Resilience/ResilienceManager.ts
      → types/index.ts
        → DatabaseProvider.ts  ← closes the cycle
```

`core/src/types/index.ts:6` imports `DatabaseProvider` directly:

```ts
import type { DatabaseProvider } from '../DatabaseProvider';
```

This import is used in `DbContextOptions` to type the `provider` field. This makes the internal `types` module depend on the concrete `DatabaseProvider` class, which in turn depends (transitively via health/resilience) on `types`.

## Evidence

- `pnpm arch:cycles` output:
  ```
  ✖ Found 1 circular dependency!
  1) core/src/DatabaseProvider.ts > core/src/Health/HealthMonitor.ts
     > core/src/Resilience/ResilienceManager.ts > core/src/types/index.ts
  ```
- `packages/core/src/types/index.ts:6`:
  ```ts
  import type { DatabaseProvider } from '../DatabaseProvider';
  ```
- `packages/core/src/types/index.ts:30`:
  ```ts
  export interface DbContextOptions {
    provider: DatabaseProvider;
    ...
  }
  ```

## Why It Matters

- **Build risk**: TypeScript composite builds and bundlers may produce non-deterministic output ordering when circular imports exist.
- **Coupling risk**: Any change to `DatabaseProvider` forces re-evaluation of `types/index.ts` and vice versa.
- **Tooling risk**: `dependency-cruiser` flags `no-circular` as an error rule; this finding is a rule violation.
- **Maintainability**: Adding new resilience or health concerns becomes risky as any type addition must avoid re-entering the cycle.

## Recommended Fix

Break the cycle by removing `DatabaseProvider` from `core/src/types/index.ts`:

1. Move `DbContextOptions.provider` type to use `@ts-linq/types` interface (e.g., `DatabaseProviderLike`) instead of the concrete `DatabaseProvider` class.
2. Alternatively, move `DbContextOptions` to `@ts-linq/types` where it has no dependency on `DatabaseProvider`.
3. `core/src/types/index.ts` should contain only types that have no inbound dependency on any class within `@ts-linq/core`.

## Acceptance Criteria

- `pnpm arch:cycles` reports zero circular dependencies.
- `core/src/types/index.ts` does not import from `../DatabaseProvider` or any sibling `.ts` class file.
- `DbContextOptions.provider` is typed via an interface, not the concrete class.
