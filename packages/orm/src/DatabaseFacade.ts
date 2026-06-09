import { ExecutionStrategy } from '@ts-linq/concurrency';
import type { DatabaseProvider } from '@ts-linq/core';
import { Queryable } from '@ts-linq/query';

import type { MigrateOptions } from './database/has-pending-model-changes';
import { PendingModelChangesChecker } from './database/has-pending-model-changes';
import type { DbSetContext } from './DbSetContext';
import type { SqlInterpolated } from './sql/sqlTag';
import { interpolatedToRaw, toSqlParam } from './sql/sqlTag';
import { DbContextTransaction } from './transactions/DbContextTransaction';

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
  private readonly _migrationsDir: string | undefined;

  constructor(context: DbSetContext, migrationsDir?: string) {
    this._context = context;
    this._migrationsDir = migrationsDir;
  }

  private readonly _context: DbSetContext;

  private get _provider(): DatabaseProvider {
    return this._context.provider;
  }

  private get _checker(): PendingModelChangesChecker {
    if (!this._migrationsDir) {
      throw new Error(
        'Migrations directory is not configured on this DbContext.\n' +
          'Call .migrations({ directory: "./migrations" }) on DbContextOptionsBuilder.'
      );
    }
    return new PendingModelChangesChecker(this._provider, this._migrationsDir);
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

  /**
   * Begin an explicit database transaction and return a `DbContextTransaction` object.
   * Mirrors EF Core's `context.Database.BeginTransactionAsync()`.
   *
   * The returned object exposes savepoint management and supports `await using`
   * for automatic rollback on scope exit.
   *
   * @example
   * await using const tx = await ctx.database.beginTransactionAsync();
   * try {
   *   await ctx.saveChanges();
   *   await tx.createSavepointAsync('before_risky');
   *   try { await doRisky(); }
   *   catch { await tx.rollbackToSavepointAsync('before_risky'); }
   *   await tx.releaseSavepointAsync('before_risky');
   *   await tx.commitAsync();
   * } catch { await tx.rollbackAsync(); }
   */
  async beginTransactionAsync(): Promise<DbContextTransaction> {
    if (!this._context.beginTransaction) {
      throw new Error('Transaction callbacks are not available on this context');
    }
    await this._context.beginTransaction();
    return new DbContextTransaction(
      this._provider,
      async () => this._context.commitTransaction!(),
      async () => this._context.rollbackTransaction!()
    );
  }

  /**
   * Create an `ExecutionStrategy` configured with the retry options set via
   * `DbContextOptionsBuilder.enableRetryOnFailure()`.
   * Mirrors EF Core's `context.Database.CreateExecutionStrategy()`.
   *
   * If no retry options have been configured, defaults to 3 retries with a
   * maximum delay of 30 000 ms.
   *
   * @example
   * const strategy = ctx.database.createExecutionStrategy();
   * await strategy.executeAsync(async () => {
   *   await ctx.saveChanges(); // retried on transient failures
   * });
   */
  createExecutionStrategy(): ExecutionStrategy {
    const opts = this._context.executionStrategyOptions ?? {
      maxRetryCount: 3,
      maxRetryDelay: 30_000
    };
    return ExecutionStrategy.fromOptions(opts, (e: unknown) =>
      this._provider.checkTransientError(e)
    );
  }

  // ---------------------------------------------------------------------------
  // Migration helpers — mirrors EF Core's Database.HasPendingModelChanges / Migrate
  // ---------------------------------------------------------------------------

  /**
   * Returns `true` when the application model (read from `MetadataStorage`) differs
   * from the snapshot committed alongside the last migration.
   *
   * This is a **synchronous** file-system check — no database access is performed.
   * Mirrors EF Core's `context.Database.HasPendingModelChanges()`.
   *
   * Requires `.migrations({ directory })` to be set on `DbContextOptionsBuilder`.
   *
   * @example
   * if (ctx.database.hasPendingModelChanges()) {
   *   throw new Error('Model is out of sync with migrations');
   * }
   */
  hasPendingModelChanges(): boolean {
    return this._checker.hasPendingModelChanges();
  }

  /**
   * Returns the list of migration versions that exist on disk but have **not**
   * yet been applied to the database.
   *
   * Mirrors EF Core's `context.Database.GetPendingMigrationsAsync()`.
   *
   * @example
   * const pending = await ctx.database.getPendingMigrations();
   * console.log(`${pending.length} migration(s) pending`);
   */
  async getPendingMigrations(): Promise<string[]> {
    return this._checker.getPendingMigrations();
  }

  /**
   * Apply all pending migrations to the database.
   *
   * When `options.idempotent` is `true`, an idempotency guard (dialect-specific
   * IF NOT EXISTS check against `__migrations`) is wrapped around each migration
   * so the operation is safe to re-run.
   *
   * Mirrors EF Core's `await context.Database.MigrateAsync()`.
   *
   * @example
   * // Standard — run pending migrations once:
   * await ctx.database.migrate();
   *
   * // Idempotent — safe to call repeatedly:
   * await ctx.database.migrate({ idempotent: true });
   */
  async migrate(options?: MigrateOptions): Promise<void> {
    return this._checker.migrate(options);
  }
}
