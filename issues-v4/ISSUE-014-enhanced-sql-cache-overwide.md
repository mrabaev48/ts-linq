# ISSUE-014: EnhancedSqlCache Is an Over-Wide Class

## Severity

Medium

## Category

- SOLID
- Maintainability

## Location

- `packages/query/src/EnhancedSqlCache.ts`

## Problem

`EnhancedSqlCache` is a 457-line class with **19 methods** that combines five distinct caching concerns into a single implementation:

1. **LRU eviction** (`ensureCapacity`, `keyMap`, `store`): tracks access order and evicts least-recently-used entries when `maxSize` is exceeded.
2. **TTL expiry** (`isExpired`, `expireEntries`, `startPeriodicCleanup`, `cleanupInterval`): expires entries after a configurable time-to-live, including a background interval timer.
3. **Key compression** (`getCompressedKey`, `compressionThreshold`): optionally compresses long cache keys.
4. **Metrics collection** (`initializeMetrics`, `getMetrics`, `updateHitRatio`, `updateAverageAccessCount`, `updateMemoryUsage`): tracks hit/miss ratios, eviction counts, estimated memory, and access frequency.
5. **Cache warming** (`warm`, `warmingBatchSize`): supports pre-population of cache entries.

Each of these is a coherent, independently useful abstraction. Composing them in a single class makes the class difficult to extend (e.g., replacing LRU with FIFO requires rewriting the entire class), and makes individual behaviors impossible to unit-test in isolation.

## Evidence

Serena symbol overview of `EnhancedSqlCache` shows 19 methods:
```
chunkArray, clear, dispose, ensureCapacity, expireEntries, get,
getCompressedKey, getMetrics, getOptimizationInsights, initializeMetrics,
invalidateBy, isExpired, set, size, startPeriodicCleanup,
updateAverageAccessCount, updateHitRatio, updateMemoryUsage, warm
```

Properties include:
```
cleanupInterval,  // TTL background timer
keyMap,           // LRU access order tracking
metrics,          // metrics state
options,          // combined options for all features
store             // main entry storage
```

## Why It Matters

- **SRP violation**: LRU, TTL, compression, metrics, and warming are five distinct policies. Combining them means a change to the LRU algorithm requires reasoning about TTL and metrics simultaneously.
- **Testability**: Testing LRU behavior requires also configuring TTL and metrics; there is no way to test eviction in isolation.
- **Extensibility**: Replacing LRU with FIFO, or adding Redis-backed warming, requires modifying the entire 457-line class.
- **Background timer leak risk**: `startPeriodicCleanup()` creates a `setInterval` owned by the cache instance. If `dispose()` is not called, the timer prevents garbage collection. This is easy to miss when the cache is composed inline.

## Recommended Fix

Decompose using the Decorator pattern:

```ts
interface SqlCache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  invalidateBy(predicate: (key: string) => boolean): void;
  clear(): void;
}

class LruCache implements SqlCache { ... }           // pure LRU, no TTL
class TtlCacheDecorator implements SqlCache { ... }  // wraps SqlCache, adds expiry
class MetricsCacheDecorator implements SqlCache { ... } // wraps SqlCache, adds metrics
```

`EnhancedSqlCache` becomes a factory/facade that composes these based on options.

## Acceptance Criteria

- LRU logic is testable independently of TTL logic.
- TTL logic is testable independently of LRU logic.
- Metrics collection is opt-in and does not increase complexity for the base `get`/`set` path.
- Background cleanup timer is managed by the TTL decorator, not the outer facade.
- `dispose()` is documented as required for cleanup.
