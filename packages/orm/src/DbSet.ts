import type { DatabaseProvider } from '@ts-linq/core';
import type { EntityLoader } from '@ts-linq/core';
import type { QueryTrackingBehavior } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { IQueryableSurface, Queryable } from '@ts-linq/query';
import type {
  GlobalFilter,
  PerformanceOptions,
  QueryFilterMetadata,
  QuerySplittingBehavior
} from '@ts-linq/types';
import { type EntityCacheLike, OrmConfigurationError } from '@ts-linq/types';

import type { ChangeTracker } from './ChangeTracker';
import { type DiagnosticSink, NULL_DIAGNOSTIC_SINK } from './context/DiagnosticSink';
import { QueryableFactory } from './context/QueryableFactory';
import { installQueryableForwarders } from './context/queryableForwarding';
import type { DbSetContext } from './DbSetContext';
import { KeylessMutationError } from './exceptions/KeylessMutationError';
import type { LocalView } from './LocalView';
import type { SqlInterpolated } from './sql/sqlTag';
import { interpolatedToRaw, toSqlParam } from './sql/sqlTag';

/**
 * Represents a typed set of entities providing CRUD operations and direct LINQ-style querying.
 * Mirrors EF Core's DbSet<T> — query methods are available directly without an intermediate .query() call.
 *
 * ## Query surface (parity, zero drift)
 *
 * `DbSet<T>` does **not** hand-mirror the ~50 `Queryable<T>` operators. Instead it
 * declaration-merges {@link IQueryableSurface} (so every operator is statically reachable with
 * full generic inference) and installs a single delegating forwarder per operator onto the
 * prototype (see {@link installQueryableForwarders}), each routed through one cached chain-starting
 * seed `Queryable` (`_seed()`). A new operator added to `@ts-linq/query` therefore surfaces on
 * `DbSet` automatically — the `DbSet ↔ Queryable` parity is guarded by a contract test rather than
 * developer discipline.
 *
 * The transformer brand (`__tsLinqWhereTransformerBrand`) and the branded `*Compiled` operators
 * remain reachable: the brand is declared on the class, the compiled operators are part of
 * {@link IQueryableSurface} (types) and the forwarder install (runtime).
 *
 * @example
 * class AppDbContext extends DbContext {
 *   users = this.set(User);
 * }
 * const adults = await ctx.users.where(u => u.age >= 18).orderBy('name').toArray();
 */
// The merged interface supplies the full, inference-preserving query surface (where/select/orderBy/
// include/terminals/aggregates/…). Implementation is provided at runtime by the forwarder install
// at the bottom of this module; declaring them on the class body would collide with the merge.
// The class/interface merge is the intentional mixin mechanism here, hence the rule disable.
export interface DbSet<T extends object> extends IQueryableSurface<T> {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
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
  private _entityQueryFilters?: ReadonlyArray<QueryFilterMetadata>;
  private _registry?: import('@ts-linq/metadata').MetadataRegistry;
  private _diagnosticSink: DiagnosticSink = NULL_DIAGNOSTIC_SINK;

  /** Cached chain-starting seed and the tracking mode it was built for (see {@link _seed}). */
  private _seedCache?: Queryable<T>;
  private _seedTracking?: QueryTrackingBehavior;

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
    this._entityQueryFilters = context.entityQueryFilterMap?.get(this._entityClass);
    this._registry = context.registry;
    this._diagnosticSink = context.diagnosticSink ?? NULL_DIAGNOSTIC_SINK;
    // Invalidate any seed built against a previous injection.
    this._seedCache = undefined;
    this._seedTracking = undefined;
  }

  private _assertNotKeyless(operation: string): void {
    const meta = this._registry
      ? this._registry.getEntity(this._entityClass)
      : MetadataStorage.getEntity(this._entityClass);
    if (meta?.isKeyless) {
      throw new KeylessMutationError(this._entityClass.name, operation);
    }
  }

  /** The entity constructor this set operates on. */
  get entityClass(): new () => T {
    return this._entityClass;
  }

  // ─── Internal Queryable seed ──────────────────────────────────────────────

  /**
   * The cached chain-starting seed `Queryable` that every forwarded operator delegates to.
   *
   * Caching avoids re-allocating a fresh `Queryable` per operator call (the former
   * `newQueryable()` hot-path). The seed is memoized on the change-tracker's current
   * `queryTrackingBehavior` — a publicly mutable field — and rebuilt only when it changes, so
   * flipping the global tracking mode between queries is still honored. The cache is also cleared
   * on (re-)injection of the context.
   *
   * `@internal` — do not call directly.
   */
  _seed(): Queryable<T> {
    if (!this._provider) {
      throw OrmConfigurationError.noDbContext(this._entityClass.name);
    }
    const tracking = this._changeTracker?.queryTrackingBehavior;
    if (!this._seedCache || this._seedTracking !== tracking) {
      this._seedCache = QueryableFactory.fromContext(this._entityClass, {
        provider: this._provider,
        entityLoader: this._entityLoader,
        entityCache: this._entityCache,
        performance: this._performance,
        globalFilters: this._globalFilters,
        softDeleteOptions: this._softDeleteOptions,
        entityAttacher: this._changeTracker,
        trackingMode: tracking,
        globalSplittingBehavior: this._querySplittingBehavior,
        entityQueryFilters: this._entityQueryFilters
      });
      this._seedTracking = tracking;
    }
    return this._seedCache;
  }

  // ─── Local / Find (P1-29) ─────────────────────────────────────────────────

  /**
   * An observable in-memory view of all entities of type `T` that are currently
   * tracked by the change tracker with state `Added`, `Unchanged`, or `Modified`.
   * Mirrors EF Core's `DbSet<T>.Local`.
   *
   * @example
   * const local = context.posts.local;
   * const off = local.subscribe(ch => console.log(ch.type, ch.entity));
   * const all = local.toArray();
   */
  get local(): LocalView<T> {
    return this._changeTracker.getLocalView<T>(this._entityClass);
  }

  /**
   * Synchronously looks up an entity in the change tracker by its primary key.
   * Returns the tracked entity instance, or `null` if not currently tracked.
   *
   * Unlike `findAsync`, this method never issues a database query.
   * For composite PKs, pass values in the same order as `primaryKeys` in the
   * entity metadata (alphabetical).
   *
   * Mirrors EF Core's `DbSet<T>.Find(keyValues)`.
   *
   * @example
   * const post = context.posts.find(42);
   * const order = context.orders.find(customerId, orderId); // composite PK
   */
  public find(...pkValues: unknown[]): T | null {
    if (!this._changeTracker) return null;
    const tracked = this._changeTracker.findTrackedByPk(this._entityClass, ...pkValues);
    return tracked ? (tracked.entity as T) : null;
  }

  /**
   * Looks up an entity by primary key: tracker first, database on cache miss.
   * On a tracker hit the entity is returned immediately without a round-trip.
   * On a miss, a `WHERE pk = ?` query is issued and the result is attached to
   * the tracker.  Returns `null` when not found in either source.
   *
   * Mirrors EF Core's `DbSet<T>.FindAsync(keyValues)`.
   *
   * @example
   * const post = await context.posts.findAsync(42);
   */
  public async findAsync(...pkValues: unknown[]): Promise<T | null> {
    // 1. Tracker hit
    if (this._changeTracker) {
      const tracked = this._changeTracker.findTrackedByPk(this._entityClass, ...pkValues);
      if (tracked) return tracked.entity as T;
    }

    // 2. Database miss — build WHERE clause from metadata
    const registry = this._registry ?? MetadataStorage.getInstance();
    const meta = registry.getEntity(this._entityClass);
    const pks = meta?.primaryKeys ? [...meta.primaryKeys].sort() : [];
    if (!pks.length || pkValues.length === 0) return null;

    let query = this._seed();
    for (let i = 0; i < pks.length; i++) {
      const col = pks[i] as keyof T & string;
      const val = pkValues[i];
      // Use whereIn for a single-value scalar equality to avoid transformer overhead.
      query = query.whereIn(col, [val as T[typeof col]]);
    }
    return query.firstOrDefault();
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
    return this._seed()._withRawSqlSource({ sql: rawSql, params });
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
    return this._seed()._withRawSqlSource({ sql: rawSql, params });
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  /** Track entity for insertion on next saveChanges(). */
  public add(entity: T): T {
    this._assertNotKeyless('add');
    this._changeTracker.add(entity, this._entityClass);
    return entity;
  }

  /** Track entity for update on next saveChanges(). */
  public update(entity: T): T {
    this._assertNotKeyless('update');
    this._changeTracker.update(entity, this._entityClass);
    return entity;
  }

  /** Track entity for deletion on next saveChanges(). */
  public remove(entity: T): T {
    this._assertNotKeyless('remove');
    this._changeTracker.remove(entity, this._entityClass);
    return entity;
  }

  /** Track multiple entities for insertion. */
  public addRange(entities: T[]): T[] {
    this._assertNotKeyless('addRange');
    for (const entity of entities) this._changeTracker.add(entity, this._entityClass);
    return entities;
  }

  /** Track multiple entities for update. */
  public updateRange(entities: T[]): T[] {
    this._assertNotKeyless('updateRange');
    for (const entity of entities) this._changeTracker.update(entity, this._entityClass);
    return entities;
  }

  /** Track multiple entities for deletion. */
  public removeRange(entities: T[]): T[] {
    this._assertNotKeyless('removeRange');
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
      throw OrmConfigurationError.noPrimaryKey(this._entityClass.name);
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
    } catch (e) {
      // Count-cache invalidation is telemetry-adjacent bookkeeping: log and
      // continue so cache-key drift is visible instead of silently swallowed.
      this._diagnosticSink.internalDiag('DbSet.invalidateCountCache', e);
    }
  }
}

// Install one delegating forwarder per Queryable operator onto DbSet.prototype, each routed through
// the cached chain-starting seed. This is the runtime half of the parity contract whose types come
// from the merged `IQueryableSurface` interface above.
installQueryableForwarders(DbSet.prototype, (self) => (self as DbSet<object>)._seed());
