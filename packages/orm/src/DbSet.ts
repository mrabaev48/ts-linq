import type { DatabaseProvider } from '@ts-linq/core';
import type { EntityLoader } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { NavigationProxy, OrderedQueryable } from '@ts-linq/query';
import type { IncludeSubquery } from '@ts-linq/query';
import { Queryable } from '@ts-linq/query';
import type { EntityCacheLike } from '@ts-linq/types';
import type {
  FallbackPolicy,
  GlobalFilter,
  PerformanceOptions,
  QueryFallback,
  QuerySplittingBehavior
} from '@ts-linq/types';

import type { ChangeTracker } from './ChangeTracker';
import type { DbSetContext } from './DbSetContext';
import type { SqlInterpolated } from './sql/sqlTag';
import { interpolatedToRaw, toSqlParam } from './sql/sqlTag';

/**
 * Represents a typed set of entities providing CRUD operations and direct LINQ-style querying.
 * Mirrors EF Core's DbSet<T> — query methods are available directly without an intermediate .query() call.
 *
 * @example
 * class AppDbContext extends DbContext {
 *   users = this.set(User);
 * }
 * const adults = await ctx.users.where(u => u.age >= 18).orderBy('name').toArray();
 */
export class DbSet<T extends object> {
  /** Used by the compile-time transformer to identify this as a queryable target. Do not use at runtime. */
  declare readonly __tsLinqWhereTransformerBrand: true;

  private readonly _entityClass: new () => T;
  private _provider!: DatabaseProvider;
  private _changeTracker!: ChangeTracker;
  private _entityLoader: EntityLoader | undefined;
  private _entityCache: EntityCacheLike | undefined;
  private _performance: PerformanceOptions | undefined;
  private _globalFilters: GlobalFilter[] | undefined;
  private _softDeleteOptions?: import('@ts-linq/types').SoftDeleteOptions;
  private _querySplittingBehavior?: QuerySplittingBehavior;
  private static readonly DEFAULT_IN_CHUNK_SIZE = 1000;

  /**
   * Create a DbSet for the given entity type.
   *
   * When used inside a DbContext subclass property initializer, the context is
   * injected automatically — no need to pass it manually:
   *
   * @example
   * class AppDbContext extends DbContext {
   *   users = this.defineSet(User);
   *   blogs = this.defineSet(Blog);
   * }
   *
   * @param entityClass  Entity constructor (required — generics are erased at runtime).
   * @param context      Optional context; injected automatically when declared on a DbContext.
   */
  constructor(entityClass: new () => T, context?: DbSetContext) {
    this._entityClass = entityClass;
    if (context) {
      this._injectContext(context);
    }
  }

  /**
   * Injects the database context into this DbSet.
   * Called automatically by DbContext when the DbSet is assigned as a property.
   * Do not call directly.
   */
  _injectContext(context: DbSetContext): void {
    this._provider = context.provider;
    this._changeTracker = context.changeTracker;
    this._entityLoader = context.entityLoader;
    this._entityCache = context.entityCache;
    this._performance = context.performance;
    this._globalFilters = context.globalFilters;
    this._softDeleteOptions = context.softDeleteOptions;
    this._querySplittingBehavior = context.querySplittingBehavior;
  }

  /** The entity constructor this set operates on. */
  get entityClass(): new () => T {
    return this._entityClass;
  }

  // ─── Internal Queryable factory ───────────────────────────────────────────

  private newQueryable(): Queryable<T> {
    if (!this._provider) {
      throw new Error(
        `DbSet<${this._entityClass.name}> has no database context. ` +
          `Declare it inside a DbContext subclass: \`${this._entityClass.name.toLowerCase()}s = this.defineSet(${this._entityClass.name})\``
      );
    }
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions,
      this._changeTracker,
      this._changeTracker?.queryTrackingBehavior,
      this._querySplittingBehavior
    );
  }

  // ─── Tracking API ─────────────────────────────────────────────────────────

  /** Return a Queryable for this set with change-tracker attachment disabled. */
  public asNoTracking(): Queryable<T> {
    return this.newQueryable().asNoTracking();
  }

  /** Return a Queryable for this set with change-tracker attachment enabled (the default). */
  public asTracking(): Queryable<T> {
    return this.newQueryable().asTracking();
  }

  /** Return a Queryable that deduplicates entities by PK without attaching to the change tracker. */
  public asNoTrackingWithIdentityResolution(): Queryable<T> {
    return this.newQueryable().asNoTrackingWithIdentityResolution();
  }

  // ─── Temporal API (SQL Server system-versioned tables / EF Core parity) ──

  /**
   * Query the entity state at a specific point in time.
   * Emits `FOR SYSTEM_TIME AS OF @p` on MSSQL; throws on other dialects.
   *
   * @example
   * const snapshot = await ctx.employees
   *   .temporalAsOf(new Date('2023-01-01'))
   *   .where(e => e.department === 'Sales')
   *   .toArray();
   */
  public temporalAsOf(pointInTime: Date): Queryable<T> {
    return this.newQueryable().temporalAsOf(pointInTime);
  }

  /**
   * Query all historical and current rows.
   * Emits `FOR SYSTEM_TIME ALL` on MSSQL; throws on other dialects.
   *
   * @example
   * const history = await ctx.employees.temporalAll().orderBy('PeriodStart').toArray();
   */
  public temporalAll(): Queryable<T> {
    return this.newQueryable().temporalAll();
  }

  /**
   * Query rows active at any point within the half-open interval [from, to).
   * Emits `FOR SYSTEM_TIME BETWEEN @from AND @to` on MSSQL; throws on other dialects.
   */
  public temporalBetween(from: Date, to: Date): Queryable<T> {
    return this.newQueryable().temporalBetween(from, to);
  }

  /**
   * Query rows active at any point within the open interval (from, to).
   * Emits `FOR SYSTEM_TIME FROM @from TO @to` on MSSQL; throws on other dialects.
   */
  public temporalFromTo(from: Date, to: Date): Queryable<T> {
    return this.newQueryable().temporalFromTo(from, to);
  }

  /**
   * Query rows whose entire active period falls within [from, to].
   * Emits `FOR SYSTEM_TIME CONTAINED IN (@from, @to)` on MSSQL; throws on other dialects.
   */
  public temporalContainedIn(from: Date, to: Date): Queryable<T> {
    return this.newQueryable().temporalContainedIn(from, to);
  }

  // ─── Raw SQL entry points ──────────────────────────────────────────────────

  /**
   * Seeds a Queryable from a safe parameterised SQL fragment (EF Core FromSqlInterpolated parity).
   * The raw SQL is wrapped as a derived table so LINQ composition keeps working:
   *   FROM (<sql>) AS t0
   *
   * @example
   * const users = await ctx.users
   *   .fromSqlInterpolated(sql`SELECT * FROM users WHERE tenant_id = ${tenantId}`)
   *   .where(u => u.isActive)
   *   .toArray();
   */
  public fromSqlInterpolated(query: SqlInterpolated): Queryable<T> {
    const { sql: rawSql, params } = interpolatedToRaw(query);
    return this.newQueryable()._withRawSqlSource({ sql: rawSql, params });
  }

  /**
   * Seeds a Queryable from a raw SQL string with explicit positional parameters.
   * Use '?' as the placeholder regardless of the underlying database.
   *
   * @example
   * const users = await ctx.users
   *   .fromSqlRaw('SELECT * FROM users WHERE id = ?', userId)
   *   .toArray();
   */
  public fromSqlRaw(rawSql: string, ...values: unknown[]): Queryable<T> {
    const params = values.map(toSqlParam);
    return this.newQueryable()._withRawSqlSource({ sql: rawSql, params });
  }

  // ─── Filter methods ───────────────────────────────────────────────────────

  /**
   * Adds a WHERE predicate. Requires the compile-time transformer (@ts-linq/transformer).
   * @example
   * const adults = await ctx.users.where(u => u.age >= 18).toArray();
   */
  public where(predicate: (entity: T) => boolean): Queryable<T> {
    return this.newQueryable().where(predicate);
  }

  /** Called by the compile-time transformer — do not call directly. */
  public whereCompiled(...args: Parameters<Queryable<T>['whereCompiled']>): Queryable<T> {
    return this.newQueryable().whereCompiled(...args);
  }

  /** Adds a WHERE IN clause for a specific column. */
  public whereIn<K extends keyof T & string>(column: K, values: ReadonlyArray<T[K]>): Queryable<T> {
    return this.newQueryable().whereIn(column, values);
  }

  /** Adds a WHERE EXISTS (subquery) predicate. */
  public whereExists<TOther>(subquery: Queryable<TOther>): Queryable<T> {
    return this.newQueryable().whereExists(subquery);
  }

  /** Adds a WHERE col IN (subquery) predicate. */
  public whereInSubquery<TOther>(
    column: keyof T & string,
    subquery: Queryable<TOther>
  ): Queryable<T> {
    return this.newQueryable().whereInSubquery(column, subquery);
  }

  // ─── Projection ───────────────────────────────────────────────────────────

  /**
   * Projects entities. Requires the compile-time transformer.
   * @example
   * const names = await ctx.users.select(u => u.name).toArray();
   */
  public select<TResult>(selector: (entity: T) => TResult): Queryable<TResult> {
    return this.newQueryable().select(selector);
  }

  /** Called by the compile-time transformer — do not call directly. */
  public selectCompiled<TResult>(
    ...args: Parameters<Queryable<T>['selectCompiled']>
  ): Queryable<TResult> {
    return this.newQueryable().selectCompiled<TResult>(...args);
  }

  // ─── Ordering ─────────────────────────────────────────────────────────────

  /** Sorts ascending by property key or lambda selector. Returns `OrderedQueryable` to enable `thenBy` chaining. */
  public orderBy<K extends keyof T>(
    keyOrSelector: K | ((entity: T) => T[keyof T])
  ): OrderedQueryable<T> {
    return this.newQueryable().orderBy(keyOrSelector);
  }

  /** Sorts descending by property key or lambda selector. Returns `OrderedQueryable` to enable `thenBy` chaining. */
  public orderByDescending<K extends keyof T>(
    keyOrSelector: K | ((entity: T) => T[keyof T])
  ): OrderedQueryable<T> {
    return this.newQueryable().orderByDescending(keyOrSelector);
  }

  // ─── Pagination ───────────────────────────────────────────────────────────

  /** Limits the number of returned rows (SQL LIMIT). */
  public take(count: number): Queryable<T> {
    return this.newQueryable().take(count);
  }

  /** Skips the given number of rows (SQL OFFSET). */
  public skip(count: number): Queryable<T> {
    return this.newQueryable().skip(count);
  }

  // ─── Grouping ─────────────────────────────────────────────────────────────

  /** Groups results by a property key (SQL GROUP BY). */
  public groupBy<K extends keyof T>(key: K): Queryable<T> {
    return this.newQueryable().groupBy(key);
  }

  /** Applies a HAVING predicate. Requires the compile-time transformer. */
  public having(predicate: (entity: T) => boolean): Queryable<T> {
    return this.newQueryable().having(predicate);
  }

  /** Called by the compile-time transformer — do not call directly. */
  public havingCompiled(...args: Parameters<Queryable<T>['havingCompiled']>): Queryable<T> {
    return this.newQueryable().havingCompiled(...args);
  }

  // ─── Distinct ─────────────────────────────────────────────────────────────

  /** Ensures distinct rows (SQL DISTINCT). */
  public distinct(): Queryable<T> {
    return this.newQueryable().distinct();
  }

  // ─── Eager loading ────────────────────────────────────────────────────────

  /**
   * Eager-loads a related entity by navigation property name, lambda selector,
   * or filtered lambda (where/orderBy/take inside include).
   * @example
   * ctx.blogs.include('posts')
   * ctx.blogs.include(b => b.posts)
   * ctx.blogs.include(b => b.posts.where(p => p.isPublished).take(10))
   */
  public include<K extends keyof T & string>(key: K): Queryable<T>;
  public include<K extends keyof T>(selector: (entity: T) => T[K]): Queryable<T>;
  public include<U>(selector: (entity: NavigationProxy<T>) => IncludeSubquery<U>): Queryable<T>;
  public include(keyOrSelector: unknown): Queryable<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.newQueryable().include(keyOrSelector as any);
  }

  // ─── Set operations ───────────────────────────────────────────────────────

  /** SQL UNION (distinct). */
  public union(other: Queryable<T>): Queryable<T> {
    return this.newQueryable().union(other);
  }

  /** SQL UNION ALL. */
  public unionAll(other: Queryable<T>): Queryable<T> {
    return this.newQueryable().unionAll(other);
  }

  /** Concatenates sequences preserving duplicates (SQL UNION ALL). */
  public concat(other: Queryable<T>): Queryable<T> {
    return this.newQueryable().concat(other);
  }

  /** SQL INTERSECT. */
  public intersect(other: Queryable<T>): Queryable<T> {
    return this.newQueryable().intersect(other);
  }

  /** SQL EXCEPT. */
  public except(other: Queryable<T>): Queryable<T> {
    return this.newQueryable().except(other);
  }

  // ─── Joins ────────────────────────────────────────────────────────────────

  /** Adds a type-safe INNER JOIN on an equality key pair. Accepts string keys or lambda selectors. */
  public innerJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: (keyof T & string) | ((entity: T) => T[keyof T]),
    rightKey: (keyof TOther & string) | ((entity: TOther) => TOther[keyof TOther]),
    alias?: string
  ): Queryable<T> {
    return this.newQueryable().innerJoinOn(otherCtor, leftKey, rightKey, alias);
  }

  /** Adds a type-safe LEFT JOIN on an equality key pair. Accepts string keys or lambda selectors. */
  public leftJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: (keyof T & string) | ((entity: T) => T[keyof T]),
    rightKey: (keyof TOther & string) | ((entity: TOther) => TOther[keyof TOther]),
    alias?: string
  ): Queryable<T> {
    return this.newQueryable().leftJoinOn(otherCtor, leftKey, rightKey, alias);
  }

  // ─── CTE / resilience / cancellation ─────────────────────────────────────

  /** Defines a named CTE (WITH ...) subquery. */
  public withCte(name: string, subquery: Queryable<unknown>): Queryable<T> {
    return this.newQueryable().withCte(name, subquery);
  }

  /** Registers a graceful-degradation fallback source. */
  public fallbackTo(source: QueryFallback<T>): Queryable<T> {
    return this.newQueryable().fallbackTo(source);
  }

  /** Overrides per-query fallback policy. */
  public withFallbackPolicy(policy: Partial<FallbackPolicy>): Queryable<T> {
    return this.newQueryable().withFallbackPolicy(policy);
  }

  /** Attaches an AbortSignal to cancel the query before it hits the provider. */
  public withAbort(signal: AbortSignal): Queryable<T> {
    return this.newQueryable().withAbort(signal);
  }

  // ─── Terminal — element retrieval ─────────────────────────────────────────

  /** Executes the query and returns all matching entities. */
  public async toArray(): Promise<T[]> {
    return this.newQueryable().toArray();
  }

  /**
   * Returns an AsyncIterable<T> that streams entities using chunked pagination.
   * Memory-bounded — suitable for large result sets (ETL, exports).
   * Mirrors EF Core's AsAsyncEnumerable().
   */
  public asAsyncEnumerable(signal?: AbortSignal): AsyncIterable<T> {
    return this.newQueryable().asAsyncEnumerable(signal);
  }

  /**
   * Executes an async action for each entity, streaming without buffering all results.
   * Mirrors EF Core's ForEachAsync().
   */
  public async forEachAsync(
    action: (entity: T) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<void> {
    return this.newQueryable().forEachAsync(action, signal);
  }

  /**
   * Materializes the query into a Map keyed by keySelector.
   * Throws on duplicate keys. Mirrors EF Core's ToDictionaryAsync().
   */
  public async toDictionaryAsync<K>(
    keySelector: (entity: T) => K,
    signal?: AbortSignal
  ): Promise<Map<K, T>>;

  public async toDictionaryAsync<K, V>(
    keySelector: (entity: T) => K,
    elementSelector: (entity: T) => V,
    signal?: AbortSignal
  ): Promise<Map<K, V>>;

  public async toDictionaryAsync<K, V = T>(
    keySelector: (entity: T) => K,
    elementSelectorOrSignal?: ((entity: T) => V) | AbortSignal,
    signal?: AbortSignal
  ): Promise<Map<K, V>> {
    if (typeof elementSelectorOrSignal === 'function') {
      return this.newQueryable().toDictionaryAsync(keySelector, elementSelectorOrSignal, signal);
    }
    const resolvedSignal = elementSelectorOrSignal ?? signal;
    return this.newQueryable().toDictionaryAsync(keySelector, resolvedSignal) as unknown as Promise<
      Map<K, V>
    >;
  }

  /** Returns the first entity, throws if none. */
  public async first(): Promise<T> {
    return this.newQueryable().first();
  }

  /** Returns the first entity or null. */
  public async firstOrDefault(): Promise<T | null> {
    return this.newQueryable().firstOrDefault();
  }

  /** Returns exactly one entity; throws if 0 or more than 1. */
  public async single(): Promise<T> {
    return this.newQueryable().single();
  }

  /** Returns one entity or null; throws if more than 1. */
  public async singleOrDefault(): Promise<T | null> {
    return this.newQueryable().singleOrDefault();
  }

  // ─── Terminal — aggregates ────────────────────────────────────────────────

  /** Returns the number of matching rows. */
  public async count(): Promise<number> {
    return this.newQueryable().count();
  }

  /** Returns true if at least one row matches. */
  public async any(): Promise<boolean> {
    return this.newQueryable().any();
  }

  /** Returns true if the sequence contains the given item. */
  public async contains(item: T): Promise<boolean> {
    return this.newQueryable().contains(item);
  }

  /** Returns the sum of a numeric property. */
  public async sum<K extends keyof T>(key: K): Promise<number> {
    return this.newQueryable().sum(key);
  }

  /** Returns the average of a numeric property. */
  public async average<K extends keyof T>(key: K): Promise<number> {
    return this.newQueryable().average(key);
  }

  /** Returns the minimum value of a property. */
  public async min<K extends keyof T>(key: K): Promise<T[K]> {
    return this.newQueryable().min(key);
  }

  /** Returns the maximum value of a property. */
  public async max<K extends keyof T>(key: K): Promise<T[K]> {
    return this.newQueryable().max(key);
  }

  // ─── Terminal — pagination ────────────────────────────────────────────────

  /** Offset-based pagination. */
  public async paginate(
    page: number,
    size: number
  ): Promise<{ items: T[]; total: number; page: number; size: number }> {
    return this.newQueryable().paginate(page, size);
  }

  /** Keyset (cursor-based) pagination. */
  public async keysetPaginate<TKey extends keyof T>(
    key: TKey,
    after: T[TKey] | null,
    size: number
  ): Promise<{ items: T[]; pageSize: number; nextAfter: T[TKey] | null }> {
    return this.newQueryable().keysetPaginate(key, after, size);
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  /** Track entity for insertion on next saveChanges(). */
  public add(entity: T): T {
    this._changeTracker.add(entity, this._entityClass);
    return entity;
  }

  /** Track entity for update on next saveChanges(). */
  public update(entity: T): T {
    this._changeTracker.update(entity, this._entityClass);
    return entity;
  }

  /** Track entity for deletion on next saveChanges(). */
  public remove(entity: T): T {
    this._changeTracker.remove(entity, this._entityClass);
    return entity;
  }

  /** Track multiple entities for insertion. */
  public addRange(entities: T[]): T[] {
    for (const entity of entities) this._changeTracker.add(entity, this._entityClass);
    return entities;
  }

  /** Track multiple entities for update. */
  public updateRange(entities: T[]): T[] {
    for (const entity of entities) this._changeTracker.update(entity, this._entityClass);
    return entities;
  }

  /** Track multiple entities for deletion. */
  public removeRange(entities: T[]): T[] {
    for (const entity of entities) this._changeTracker.remove(entity, this._entityClass);
    return entities;
  }

  /** Provider-level bulk insert within a transaction. */
  public async insertMany(entities: T[]): Promise<T[]> {
    const result = await this._provider.insertMany<T>(entities, this._entityClass);
    this.invalidateCountCache();
    return result;
  }

  /** Provider-level bulk update within a transaction. */
  public async updateMany(entities: T[]): Promise<T[]> {
    const result = await this._provider.updateMany<T>(entities, this._entityClass);
    this.invalidateCountCache();
    return result;
  }

  /** Upsert single entity by primary key existence check. */
  public async upsert(entity: T): Promise<T> {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || !metadata.primaryKeys || metadata.primaryKeys.length === 0)
      throw new Error(`No primary key defined for ${this._entityClass.name}`);
    const pk = metadata.primaryKeys[0];
    const id = (entity as unknown as Record<string, unknown>)[pk];
    if (id === undefined || id === null) {
      this.add(entity);
      return entity;
    }
    const existing = await this._provider.findById(id, this._entityClass);
    if (existing) {
      this.update(entity);
    } else {
      this.add(entity);
    }
    return entity;
  }

  /** Upsert many entities directly via provider (no saveChanges() needed). */
  public async upsertMany(entities: T[]): Promise<T[]> {
    const result = await this._provider.upsertMany<T>(entities, this._entityClass);
    this.invalidateCountCache();
    return result;
  }

  private invalidateCountCache(): void {
    try {
      const extCount = this._performance?.countCache;
      if (!extCount?.invalidateBy) return;

      const providerLabel = this._provider.providerLabel;
      const providerPrefix = providerLabel ? `${providerLabel}|` : '';
      const ns = this._performance?.cacheNamespace ? `${this._performance.cacheNamespace}|` : '';
      const entityName = this._entityClass.name;

      const prefix = `${ns}${providerPrefix}${entityName}|count|`;
      extCount.invalidateBy((key: string) => key.startsWith(prefix));
    } catch {
      // ignore errors during cache invalidation
    }
  }
}
