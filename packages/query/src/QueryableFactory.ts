import type { DatabaseProvider, EntityLoader } from '@ts-linq/core';
import type { CountCache, SqlCache, SqlCacheMetrics, SqlParameter } from '@ts-linq/types';

import { InMemoryCountCache } from './CountCache';
import { EnhancedSqlCache } from './EnhancedSqlCache';
import { Queryable } from './Queryable';
import { type QueryableSeedProps, QueryContext } from './QueryContext';

/**
 * A {@link SqlCache} the caller *owns*: it holds a background cleanup timer and therefore must be
 * {@link OwnedSqlCache.dispose | disposed} when the owning context is disposed. Returned by
 * {@link createDefaultSqlCache} so consumers (notably `@ts-linq/orm`'s `DbContext`) can type the
 * owned cache without importing the concrete query-internal `EnhancedSqlCache` class.
 *
 * @public
 */
export interface OwnedSqlCache extends SqlCache {
  /** Stop the background cleanup timer and release resources. */
  dispose(): void;
  /** Snapshot cache metrics for monitoring. */
  getMetrics?(): SqlCacheMetrics;
}

/**
 * The single public construction seam for a chain-starting {@link Queryable}. Assembles the
 * query-internal {@link QueryContext} from the public {@link QueryableSeedProps} so callers never
 * depend on `@ts-linq/query/internal` (orm/task-6.1).
 *
 * @public
 */
export function createQueryable<T extends object>(
  entityClass: new () => T,
  props: QueryableSeedProps
): Queryable<T> {
  return new Queryable<T>(entityClass, new QueryContext(props));
}

/**
 * Build a raw-SQL-seeded {@link Queryable}: the SQL fragment is wrapped as a derived table for
 * further LINQ composition. Hides both the internal {@link QueryContext} and the internal
 * `Queryable._withRawSqlSource` seam from callers.
 *
 * @public
 */
export function createRawSqlQueryable<T extends object>(
  entityClass: new () => T,
  provider: DatabaseProvider,
  entityLoader: EntityLoader | undefined,
  sql: string,
  params: readonly SqlParameter[]
): Queryable<T> {
  return new Queryable<T>(
    entityClass,
    new QueryContext({ provider, entityLoader })
  )._withRawSqlSource({ sql, params });
}

/**
 * Create the default owned SQL cache. Consumers that do not supply their own `SqlCache` use this
 * so its background timer can be stopped via {@link OwnedSqlCache.dispose}.
 *
 * @public
 */
export function createDefaultSqlCache(): OwnedSqlCache {
  return new EnhancedSqlCache();
}

/**
 * Create the default in-memory count cache used when a consumer does not supply its own.
 *
 * @public
 */
export function createDefaultCountCache(): CountCache {
  return new InMemoryCountCache();
}
