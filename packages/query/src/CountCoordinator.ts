import type { DatabaseProvider } from '@ts-linq/core';
import { safeCache, safeCacheSize } from '@ts-linq/metrics-safe';
import type { CountCache, PerformanceOptions } from '@ts-linq/types';

import type { QueryModel } from './QueryModel';

/** Minimal structural view of the executor used to run the COUNT query. */
interface CountExecutor {
  executeCount(tableName: string, model: QueryModel): Promise<number>;
}

/**
 * Everything {@link CountCoordinator} needs to satisfy one `count()` call. The single-flight map
 * and the external cache are owned by the `Queryable` instance (per-chain state) and passed in by
 * reference, so the coordinator itself stays stateless.
 */
export interface CountRequest {
  /** `entityClass.name` — used only for the cache key. */
  entityName: string;
  tableName: string;
  whereSignature: string;
  performance: PerformanceOptions | undefined;
  provider: DatabaseProvider;
  executor: CountExecutor;
  /** Per-chain single-flight dedup map (owned by the facade). */
  inflightCounts: Map<string, Promise<number>>;
  externalCountCache: CountCache | undefined;
  /** Lazily builds the (filter-applied) query model — invoked only on a cache miss. */
  prepareModel: () => QueryModel;
}

/**
 * Coordinates `count()` execution: external count-cache lookup, single-flight deduplication of
 * concurrent in-flight counts, TTL bookkeeping and cache-metrics emission.
 *
 * Stateless — a single instance is shared by reference across all clones of a `Queryable` chain;
 * all per-chain state (the in-flight map, the external cache) is supplied via {@link CountRequest}.
 */
export class CountCoordinator {
  async count(req: CountRequest): Promise<number> {
    const { performance, provider, executor, inflightCounts, externalCountCache, tableName } = req;

    if (performance?.enableCountCache) {
      const key = this.buildCacheKey(req);
      const inflight = inflightCounts.get(key);
      if (inflight) return inflight;
      const ttl = performance.countCacheTtlMs ?? 0;
      const hit = externalCountCache?.get(key);
      if (hit !== undefined) {
        safeCache(provider.loggerRef, {
          cache: 'count',
          hit: true,
          provider: provider.providerLabel,
          ttl: ttl > 0
        });
        provider.loggerRef?.cache?.({
          cache: 'count',
          hit: true,
          provider: provider.providerLabel
        });
        return hit;
      }
      const pending = executor.executeCount(tableName, req.prepareModel());
      inflightCounts.set(key, pending);
      let value: number;
      try {
        value = await pending;
      } finally {
        inflightCounts.delete(key);
      }
      if (externalCountCache) externalCountCache.set(key, value);
      safeCacheSize(provider.loggerRef, {
        cache: 'count',
        size: -1,
        provider: provider.providerLabel
      });
      safeCache(provider.loggerRef, {
        cache: 'count',
        hit: false,
        provider: provider.providerLabel
      });
      provider.loggerRef?.cache?.({
        cache: 'count',
        hit: false,
        provider: provider.providerLabel
      });
      return value;
    }

    return executor.executeCount(tableName, req.prepareModel());
  }

  private buildCacheKey(req: CountRequest): string {
    const provider = req.provider?.providerLabel ? `${req.provider.providerLabel}|` : '';
    const ns = req.performance?.cacheNamespace ? `${req.performance.cacheNamespace}|` : '';
    return `${ns}${provider}${req.entityName}|count|${req.tableName}|${req.whereSignature}`;
  }
}
