import type { DatabaseProvider, EntityLoader } from '@ts-linq/core';
import {
  createQueryable,
  createRawSqlQueryable,
  type Queryable,
  type QueryableSeedProps
} from '@ts-linq/query';
import type { SqlParameter } from '@ts-linq/types';

/** Raw SQL seed: a SQL fragment wrapped as a derived table for further LINQ composition. */
export interface RawSqlSource {
  readonly sql: string;
  readonly params: readonly SqlParameter[];
}

/**
 * The single construction site for {@link Queryable} within `@ts-linq/orm`.
 *
 * Delegates to the public `@ts-linq/query` boundary seam (`createQueryable` /
 * `createRawSqlQueryable`) so orm never depends on the internal `QueryContext` — the seam owns the
 * `QueryContext` + `Queryable` assembly (orm/task-6.1). Shared by {@link DbSet} (its cached seed +
 * raw-SQL entry points) and `DatabaseFacade` (`sqlQuery` / `sqlQueryRaw`).
 *
 * @internal
 */
export const QueryableFactory = {
  /**
   * Build a fully-configured seed `Queryable` from a set of {@link QueryableSeedProps}.
   * Used by `DbSet` to materialize its cached chain-starting seed.
   */
  fromContext<T extends object>(entityClass: new () => T, props: QueryableSeedProps): Queryable<T> {
    return createQueryable<T>(entityClass, props);
  },

  /**
   * Build a raw-SQL-seeded `Queryable` from a minimal context (provider + optional loader).
   * Used by `DbSet.fromSqlRaw`/`fromSqlInterpolated` and `DatabaseFacade.sqlQuery`/`sqlQueryRaw`.
   */
  raw<T extends object>(
    entityClass: new () => T,
    provider: DatabaseProvider,
    entityLoader: EntityLoader | undefined,
    source: RawSqlSource
  ): Queryable<T> {
    return createRawSqlQueryable<T>(entityClass, provider, entityLoader, source.sql, source.params);
  }
} as const;
