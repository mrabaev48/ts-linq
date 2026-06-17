import type { DatabaseProvider, EntityLoader } from '@ts-linq/core';
import { Queryable } from '@ts-linq/query';
import { QueryContext, type QueryContextProps } from '@ts-linq/query/internal';
import type { SqlParameter } from '@ts-linq/types';

/** Raw SQL seed: a SQL fragment wrapped as a derived table for further LINQ composition. */
export interface RawSqlSource {
  readonly sql: string;
  readonly params: readonly SqlParameter[];
}

/**
 * The single construction site for {@link Queryable} within `@ts-linq/orm`.
 *
 * Centralizes assembly of the `QueryContext` + `Queryable` pair so the (previously duplicated)
 * `new Queryable(entityClass, new QueryContext({...}))` incantation lives in exactly one place,
 * shared by {@link DbSet} (its cached seed + raw-SQL entry points) and `DatabaseFacade`
 * (`sqlQuery` / `sqlQueryRaw`).
 *
 * @internal
 */
export const QueryableFactory = {
  /**
   * Build a fully-configured seed `Queryable` from a set of {@link QueryContextProps}.
   * Used by `DbSet` to materialize its cached chain-starting seed.
   */
  fromContext<T extends object>(entityClass: new () => T, props: QueryContextProps): Queryable<T> {
    return new Queryable<T>(entityClass, new QueryContext(props));
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
    return new Queryable<T>(
      entityClass,
      new QueryContext({ provider, entityLoader })
    )._withRawSqlSource(source);
  }
} as const;
