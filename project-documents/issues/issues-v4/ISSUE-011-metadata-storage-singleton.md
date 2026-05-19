# ISSUE-011: MetadataStorage Singleton Causes Test Pollution and Limits Multi-Tenancy

## Severity

High

## Category

- Testability
- Clean Architecture

## Location

- `packages/metadata/src/MetadataStorage.ts`
- `packages/core/src/decorators/` (Entity, Column, PrimaryKey, Relationships, ValidIf)
- `packages/core/src/types/index.ts:34-36`

## Problem

`MetadataStorage` is implemented as a process-wide singleton:

```ts
// MetadataStorage.ts:21-26
static getInstance(): MetadataStorage {
  if (!MetadataStorage.instance) {
    MetadataStorage.instance = new MetadataStorage(...);
  }
  return MetadataStorage.instance;
}
```

All decorator functions (`@Entity`, `@Column`, `@PrimaryKey`, `@Relationship`, `@ValidIf`) write to this singleton as side effects of class decoration — which happens at module load time, before any test setup code runs.

This creates two problems:

**1. Test pollution**: Entity metadata registered by one test file persists for the lifetime of the process. Jest's `jest.resetModules()` does not clear `Reflect` metadata or the `MetadataStorage` singleton. Tests that register the same entity name or table name in different test files may interfere with each other depending on execution order.

**2. Incomplete multi-tenant isolation**: `DbContextOptions.registry` (in `core/src/types/index.ts:34`) provides an escape hatch — callers can supply a `MetadataRegistry` instance instead of using the singleton. However, decorators always write to the singleton, not the registry passed to `DbContext`. This means an isolated `DbContext` still inherits all metadata from the global singleton, defeating the isolation goal.

## Evidence

`packages/metadata/src/MetadataStorage.ts:21-26`: `getInstance()` with lazy static initialization.

`packages/core/src/types/index.ts:34-36`:
```ts
/**
 * Metadata registry to use for this context.
 * Defaults to the process-wide registry (MetadataStorage.getInstance()).
 * Provide an isolated MetadataRegistry for multi-tenant setups or test isolation.
 */
registry?: import('@ts-linq/metadata').MetadataRegistry;
```
The comment acknowledges the problem but the escape hatch is incomplete because decorators never use the provided registry.

## Why It Matters

- **Test flakiness**: Test order can affect results when entities share names or column metadata across test files.
- **Multi-tenant correctness**: A multi-tenant application creating `DbContext` per tenant with isolated registries still shares global metadata from decorators.
- **DI incompatibility**: Frameworks like NestJS that manage module lifecycles cannot inject an alternative `MetadataStorage` because decorators bypass any injection mechanism.

## Recommended Fix

1. Provide a test utility `MetadataStorage.reset()` (or use the existing `reset()` method) and call it in `beforeEach` / `afterEach` for test suites that register entities.
2. Export a `createMetadataRegistry()` factory from `@ts-linq/metadata` for test isolation.
3. Long-term: refactor decorators to accept an optional registry target:
   ```ts
   @Entity({ name: 'users', registry: myIsolatedRegistry })
   class User { ... }
   ```
4. Document the singleton behavior and its test isolation implications prominently in the `@ts-linq/metadata` README.

## Acceptance Criteria

- A `MetadataStorage.reset()` (or equivalent) method exists and is documented for test use.
- Integration test setup calls `reset()` to ensure a clean slate between test suites.
- `DbContext` with a custom `registry` does not inherit entity metadata registered only in the singleton by other test files.
- Multi-tenant isolation test demonstrates independent entity sets in two `DbContext` instances.
