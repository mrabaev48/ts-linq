import type { SqlCacheMetrics } from './EnhancedSqlCache';

/** Cache tuning insights, as produced by {@link EnhancedSqlCache.getOptimizationInsights}. */
export interface SqlCacheOptimizationInsights {
  shouldIncreaseSize: boolean;
  shouldDecreaseTtl: boolean;
  shouldIncreaseTtl: boolean;
  topAccessedEntries: Array<{ key: string; accessCount: number }>;
}

/**
 * Optional capability surface a {@link SqlCache} implementation may expose.
 * Used to program against the interface instead of `instanceof EnhancedSqlCache`.
 */
export interface SqlCacheCapabilities {
  getMetrics?(): SqlCacheMetrics;
  getOptimizationInsights?(): SqlCacheOptimizationInsights;
  dispose?(): void;
}
