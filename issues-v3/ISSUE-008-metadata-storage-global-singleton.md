# ISSUE-008: `MetadataStorage` Process-Wide Singleton Causes Hidden Global State

## Severity

Medium

## Category

- Testability
- Maintainability
- Clean Code

## Location

- `packages/metadata/src/MetadataStorage.ts`
- All decorator files in `packages/core/src/decorators/` — `Entity.ts`, `Column.ts`, `PrimaryKey.ts`, `Relationships.ts`, `ValidIf.ts`, `CachePolicy.ts`

## Problem

`MetadataStorage` is a static singleton wrapping a lazily initialized `MetadataRegistry`:

```typescript
export class MetadataStorage {
  private static _defaultRegistry: MetadataRegistry | undefined;

  public static getInstance(): MetadataRegistry {
    if (!MetadataStorage._defaultRegistry) {
      MetadataStorage._defaultRegistry = new MetadataRegistry();
    }
    return MetadataStorage._defaultRegistry;
  }
}
```

All entity decorators (`@Entity`, `@Column`, `@PrimaryKey`, `@OneToMany`, etc.) write to this singleton at **class definition time** — i.e., when the module is first imported. This means:

1. Metadata accumulates as a side effect of `import` statements, not of explicit registration
2. The global registry persists across all test files in the same process
3. Test pollution is real: entity metadata registered in test file A leaks into test file B unless `MetadataStorage.reset()` is called explicitly

The `MetadataRegistry` class is injectable (designed correctly), but the static facade `MetadataStorage` defeats this by being the single global entry point that decorators use by default.

## Evidence

```typescript
// packages/metadata/src/MetadataStorage.ts
private static _defaultRegistry: MetadataRegistry | undefined;

public static setDefaultRegistry(registry: MetadataRegistry): void {
  MetadataStorage._defaultRegistry = registry;
}

public static reset(): void {
  MetadataStorage._defaultRegistry = new MetadataRegistry();
}
```

The fact that `reset()` and `setDefaultRegistry()` exist confirms that test isolation is already a known concern. But relying on developers to call `reset()` in `beforeEach`/`afterEach` is fragile and easy to forget.

In `packages/core/src/decorators/Entity.ts` (and all other decorators), the pattern is:
```typescript
MetadataStorage.registerEntity(target); // at class-definition time
```

This fires on import, not on instantiation.

## Why It Matters

- **Testability risk**: Tests that import entity classes automatically write to global metadata. Any test that creates entity classes dynamically or modifies decorator metadata will affect other tests running in the same Jest worker.
- **Hidden global state**: The singleton is invisible to the dependency graph — there is no import that reveals the global side effect.
- **Parallel test risk**: Jest's `--runInBand` mode serializes tests, masking isolation issues. With parallel workers, each worker gets its own module registry, but within a worker test ordering matters.
- **Multi-tenant risk**: In server environments where multiple `DbContext` instances are created with different entity sets, there is only one global `MetadataRegistry`. The injectable `MetadataRegistry` in `DbContextOptions` partially addresses this, but the decorator-time registration always goes to the global singleton first.

## Recommended Fix

1. **Enforce explicit injection in tests**: The test setup in `packages/testkits/` should call `MetadataStorage.reset()` in a global `beforeEach` hook, and document this requirement.

2. **Long-term**: Transition decorators to register metadata lazily (on first access) rather than eagerly at class-definition time. The `PendingMetadataCollector` in `MetadataRegistry.ts` suggests this pattern is partially in place — formalize it.

3. **Module-scoped registry option**: Allow creating a `MetadataRegistry` that auto-captures decorator applications within a given module scope, without polluting the global singleton. This is complex but enables true isolation.

4. **Document the invariant**: Add a JSDoc comment to `MetadataStorage` stating that it is a process-wide singleton, that `reset()` must be called between tests, and that `DbContextOptions.registry` should be used for isolated contexts.

## Acceptance Criteria

- Test suite documentation (or `packages/testkits/README.md`) explicitly states that `MetadataStorage.reset()` must be called between tests
- Global `beforeEach`/`afterEach` in test setup files calls `MetadataStorage.reset()`
- No test file relies on state from a previously-registered entity class bleeding in from another test file
- A lint rule or comment in decorator files warns that registration is a module-level side effect
