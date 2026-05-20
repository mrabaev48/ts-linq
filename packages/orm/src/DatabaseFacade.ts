import type { DatabaseProvider } from '@ts-linq/core';
import { Queryable } from '@ts-linq/query';

import type { DbSetContext } from './DbSetContext';
import type { SqlInterpolated } from './sql/sqlTag';
import { interpolatedToRaw, toSqlParam } from './sql/sqlTag';

/**
 * Provides access to database-level raw SQL operations that are not entity-bound.
 * Mirrors EF Core's DatabaseFacade / Database property on DbContext.
 *
 * Accessed via `ctx.database`.
 *
 * @example
 * // Non-query (UPDATE/DELETE/INSERT)
 * const affected = await ctx.database.executeSqlInterpolated(
 *   sql`UPDATE users SET locked = true WHERE last_login < ${cutoff}`
 * );
 *
 * // Ad-hoc SELECT with entity class
 * const results = await ctx.database
 *   .sqlQuery(sql`SELECT * FROM users WHERE active = ${true}`, User)
 *   .where(u => u.age > 18)
 *   .toArray();
 */
export class DatabaseFacade {
  constructor(private readonly _context: DbSetContext) {}

  private get _provider(): DatabaseProvider {
    return this._context.provider;
  }

  /**
   * Execute a non-query SQL statement built from a tagged-template literal.
   * Returns the number of rows affected.
   *
   * @example
   * await ctx.database.executeSqlInterpolated(
   *   sql`DELETE FROM sessions WHERE expires_at < ${new Date()}`
   * );
   */
  async executeSqlInterpolated(query: SqlInterpolated): Promise<number> {
    const { sql, params } = interpolatedToRaw(query);
    const formatted = this._provider.formatSqlWithParams(sql, params);
    return this._provider.executeNonQuery(formatted.sql, formatted.params);
  }

  /**
   * Execute a non-query raw SQL string.
   * Use '?' as parameter placeholder; the provider converts to the dialect style.
   * Returns the number of rows affected.
   *
   * @example
   * await ctx.database.executeSqlRaw(
   *   'DELETE FROM sessions WHERE user_id = ?', userId
   * );
   */
  async executeSqlRaw(rawSql: string, ...values: unknown[]): Promise<number> {
    const params = values.map(toSqlParam);
    const formatted = this._provider.formatSqlWithParams(rawSql, params);
    return this._provider.executeNonQuery(formatted.sql, formatted.params);
  }

  /**
   * Execute a parameterised SELECT via tagged-template and return a composable Queryable<T>.
   * T must be a class decorated with @Entity (for full ORM support) or any plain class
   * (for raw row-to-object mapping).
   *
   * Note: unlike EF Core's Database.SqlQuery<T>, TypeScript's type erasure requires
   * an explicit entityClass constructor as the second argument.
   *
   * @example
   * const rows = await ctx.database
   *   .sqlQuery(sql`SELECT * FROM users WHERE active = ${true}`, User)
   *   .orderBy('name')
   *   .toArray();
   */
  sqlQuery<T extends object>(query: SqlInterpolated, entityClass: new () => T): Queryable<T> {
    const { sql, params } = interpolatedToRaw(query);
    return new Queryable<T>(
      entityClass,
      this._provider,
      this._context.entityLoader
    )._withRawSqlSource({ sql, params });
  }

  /**
   * Execute a raw SQL SELECT and return a composable Queryable<T>.
   * Use '?' as parameter placeholder.
   *
   * @example
   * const rows = await ctx.database
   *   .sqlQueryRaw('SELECT * FROM users WHERE id = ?', User, userId)
   *   .toArray();
   */
  sqlQueryRaw<T extends object>(
    rawSql: string,
    entityClass: new () => T,
    ...values: unknown[]
  ): Queryable<T> {
    const params = values.map(toSqlParam);
    return new Queryable<T>(
      entityClass,
      this._provider,
      this._context.entityLoader
    )._withRawSqlSource({ sql: rawSql, params });
  }
}
