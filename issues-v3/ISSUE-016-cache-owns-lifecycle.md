# ISSUE-016: `EnhancedSqlCache` Owns Its Own Cleanup Interval Lifecycle

## Severity

Low

## Category

- SOLID
- Maintainability
- Testability

## Location

- `packages/query/src/EnhancedSqlCache.ts` (457 lines)
- Line 435: `const maybe = this.cleanupInterval as unknown as { unref?: () => void } | undefined;`

## Problem

`EnhancedSqlCache` is a SQL query result cache. In addition to caching logic (set, get, invalidate, metrics), it also manages its own background cleanup interval using `setInterval`. This creates a lifecycle coupling: the cache both stores data and manages a background timer process.

```typescript
// packages/query/src/EnhancedSqlCache.ts:435
const maybe = this.cleanupInterval as unknown as { unref?: () => void } | undefined;
```

The `unref()` call (a Node.js-specific timer API) reveals that the cache is aware of its runtime environment (Node.js vs browser). This environment awareness should not live inside a cache class.

Problems introduced:

1. **Lifecycle ambiguity**: Who is responsible for stopping the cleanup interval? If `DbContext.dispose()` is not called, the interval continues running, keeping the process alive.
2. **Testability**: Unit tests for cache eviction behavior must either deal with real timers (using `jest.useFakeTimers`) or the background interval fires unexpectedly during tests.
3. **SRP violation**: Cache data management and cache lifecycle management are separate concerns.
4. **Environment coupling**: The `unref()` call assumes a Node.js timer, not a generic `clearInterval` handle.
5. **457 lines**: For a cache class, this is large. Lifecycle and metrics tracking have grown alongside caching.

## Evidence

```typescript
// EnhancedSqlCache.ts — owns a setInterval cleanup timer
// EnhancedSqlCache.ts:435
const maybe = this.cleanupInterval as unknown as { unref?: () => void } | undefined;
if (maybe?.unref) {
  maybe.unref(); // Node.js-specific
}
```

## Why It Matters

- **Testability**: Tests must handle background timers, adding noise and fragility.
- **Resource leak risk**: If `dispose()` is never called, the interval continues running, preventing Node.js process exit.
- **Coupling**: The cache is coupled to its deployment environment (Node.js timer API).
- **SRP**: Two responsibilities in one class make it harder to replace caching strategy (e.g., switching from LRU to LFU) without also rewriting lifecycle management.

## Recommended Fix

Extract lifecycle management:

```typescript
// Cache manages only data:
class EnhancedSqlCache {
  get(key: string): CachedResult | undefined { ... }
  set(key: string, value: CachedResult): void { ... }
  evictExpired(): void { ... } // public, no timer inside
  invalidate(pattern: string): void { ... }
}

// Separate scheduler manages cleanup:
class CacheEvictionScheduler {
  constructor(private cache: { evictExpired(): void }, intervalMs: number) {
    this.timer = setInterval(() => cache.evictExpired(), intervalMs);
  }
  dispose(): void { clearInterval(this.timer); }
}
```

`DbContext` (or `CacheCoordinator` from ISSUE-002) creates the cache, wraps it in a scheduler, and disposes both together.

## Acceptance Criteria

- `EnhancedSqlCache` contains no `setInterval` or `clearInterval` calls
- Cleanup scheduling is external to the cache class
- No `unref()` call or Node.js timer API usage inside `EnhancedSqlCache`
- Cache unit tests do not require `jest.useFakeTimers()` to avoid timer interference
- `DbContext.dispose()` correctly stops the external scheduler
