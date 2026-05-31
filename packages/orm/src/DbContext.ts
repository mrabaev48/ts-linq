import type { DatabaseProvider } from '@ts-linq/core';
import type { LoadingOptions } from '@ts-linq/core';
import type { DbContextOptions, DiagnosticsOptions, MemoryProfilerLike } from '@ts-linq/core';
import type { SaveChangesEventData } from '@ts-linq/core';
import { EntityLoader, InterceptionResult } from '@ts-linq/core';
import { LoadingStrategy } from '@ts-linq/core';
import { LazyLoadingProxy } from '@ts-linq/core';
import { EntityCache } from '@ts-linq/core';
import { type MetadataRegistry, MetadataStorage, reflectGetOwnMetadata } from '@ts-linq/metadata';
import { safeCacheSize } from '@ts-linq/metrics-safe';
import { EnhancedSqlCache, InMemoryCountCache } from '@ts-linq/query/internal';
import { DiagnosticEmitter } from '@ts-linq/telemetry';
import type { GlobalFilter, PerformanceOptions, Result, SoftDeleteOptions } from '@ts-linq/types';
import type { EntityCacheLike, LoadingDefaults } from '@ts-linq/types';
import { err, ok } from '@ts-linq/types';
import { OptimisticConcurrencyError } from '@ts-linq/types';

import { ChangeTracker, type JoinRowChange } from './ChangeTracker';
import { EntityEntry } from './changetracker/EntityEntry';
import { DeleteCommand } from './commands/DeleteCommand';
import { FragmentDmlExecutor } from './commands/FragmentDmlExecutor';
import { InsertCommand } from './commands/InsertCommand';
import { UpdateCommand } from './commands/UpdateCommand';
import { DatabaseFacade } from './DatabaseFacade';
import { DbSet } from './DbSet';
import type { DbSetContext } from './DbSetContext';
import { DbUpdateConcurrencyException } from './exceptions/DbUpdateConcurrencyException';
import { InterceptorRegistry } from './interceptors/InterceptorRegistry';
import { type EntityQueryFilterMap, ModelBuilder } from './ModelBuilder';
import { BatchExecutor } from './save-changes/batch-executor';
import { AuditInterceptor } from './services/AuditInterceptor';
import { CacheCoordinator } from './services/CacheCoordinator';
import { ChangeValidationService } from './services/ChangeValidationService';
import { SoftDeleteInterceptor } from './services/SoftDeleteInterceptor';
import type { NormalizedChange } from './types';
// import { logInternalError } from '@ts-linq/core'; // REMOVED

function getOriginal<T extends Function>(target: T): T {
  const maybe = reflectGetOwnMetadata('orm:original', target);
  return (maybe as T | undefined) ?? target;
}

/**
 * Base unit-of-work style context that orchestrates entity sets, change tracking
 * and database provider interactions. Similar to Entity Framework's `DbContext`.
 *
 * Note about auto-generated DbSet properties:
 * - For each registered entity class `User`, a property is created on the context instance
 *   using a simple pluralization of the lowercased class name:
 *   `<ClassName>.toLowerCase() + 's'`, with a basic `y → ies` rule.
 *   Examples: `Author` → `authors`, `Book` → `books`, `Category` → `categories`.
 * - If you want a different property name, either add your own getter that returns `set(YourEntity)`,
 *   or use `set(YourEntity)` directly instead of the auto-generated property.
 */
export abstract class DbContext {
  private _provider: DatabaseProvider;
  private _registry: MetadataRegistry;
  private _changeTracker: ChangeTracker;
  private _entityLoader: EntityLoader;
  private _dbSets: Map<Function, DbSet<object>> = new Map();
  private _decoratedDbSets: Map<Function, DbSet<object>> = new Map();
  private _defaultLoadingStrategy: LoadingStrategy = LoadingStrategy.Eager;
  private _entityCache?: EntityCacheLike;
  private _performanceOptions?: PerformanceOptions;
  private _loadingDefaults: LoadingDefaults = {};
  private _softDelete?: SoftDeleteOptions;
  private _globalFilters?: GlobalFilter[];
  private _entityQueryFilterMap: EntityQueryFilterMap = new Map();
  private _diagnostics?: DiagnosticsOptions;
  private _memoryProfiler?: MemoryProfilerLike;
  private _validationService!: ChangeValidationService;
  private _insertCmd!: InsertCommand;
  private _updateCmd!: UpdateCommand;
  private _deleteCmd!: DeleteCommand;
  private _fragmentExecutor!: FragmentDmlExecutor;
  /** SQL cache created and owned by this context (undefined when user supplied their own). */
  private _ownedSqlCache?: EnhancedSqlCache;
  private _querySplittingBehavior?: import('@ts-linq/types').QuerySplittingBehavior;
  private _cacheCoordinator!: CacheCoordinator;
  private _auditInterceptor!: AuditInterceptor;
  private _softDeleteInterceptor!: SoftDeleteInterceptor;
  private _interceptorRegistry!: InterceptorRegistry;
  private _transactionDepth = 0;
  private _database!: DatabaseFacade;
  private _executionStrategyOptions?: import('@ts-linq/types').ExecutionStrategyOptions;
  /** @internal Callback set by a pooled factory; overrides dispose to return context to pool. */
  private _returnToPool?: () => Promise<void>;
  /** maxBatchSize from DbContextOptionsBuilder.maxBatchSize(); 0 = per-row path. */
  private _maxBatchSize = 0;

  /**
   * Create a new database context instance.
   *
   * @param options Connection and provider configuration.
   */
  constructor(options: DbContextOptions) {
    // Initialize database provider from options
    this._provider = options.provider as DatabaseProvider;
    this._executionStrategyOptions = options.executionStrategy;
    this._softDelete = options.softDelete;
    // Propagate soft-delete settings into provider for GlobalFilterApplier and ProviderStub
    this._provider.configureSoftDelete(options.softDelete);
    // Wire DiagnosticEmitter when logTo() was configured on the builder
    if (options.logging?.sink) {
      this._provider.attachLogger(new DiagnosticEmitter(options.logging));
    }
    this._globalFilters = options.globalFilters;
    this._diagnostics = options.diagnostics;
    // Start external memory profiler if provided
    const mp = this._diagnostics?.memoryProfiler;
    if (mp) {
      this._memoryProfiler = mp;
      mp.start?.();
    }
    this._validationService = new ChangeValidationService(
      options.validation?.translate,
      options.audit
    );

    this._registry = options.registry ?? MetadataStorage.getInstance();
    this._changeTracker = new ChangeTracker(this._registry);
    this._entityLoader = new EntityLoader(this._provider);
    this._querySplittingBehavior = options.querySplittingBehavior;
    this._maxBatchSize = options.maxBatchSize ?? 0;
    this._insertCmd = new InsertCommand(this._provider, (c) =>
      this._cacheCoordinator.updateEntry(c)
    );
    this._updateCmd = new UpdateCommand(this._provider, (c) =>
      this._cacheCoordinator.updateEntry(c)
    );
    this._fragmentExecutor = new FragmentDmlExecutor(this._provider);
    this._deleteCmd = new DeleteCommand(
      this._provider,
      async (c) => this._softDeleteInterceptor.apply(c),
      (c) => this._cacheCoordinator.removeEntry(c)
    );
    // Initialize optional L2 entity cache
    if (options.performance?.enableEntityCache) {
      this._entityCache =
        options.performance.entityCache ??
        new EntityCache(
          options.performance.entityCacheSize ?? 10000,
          this._provider.loggerRef,
          this._provider.providerLabel
        );
    }
    // Create an owned SQL cache when none is supplied so that dispose() can stop its timer.
    // When the user passes their own SqlCache we leave ownership with them.
    this._ownedSqlCache = options.performance?.sqlCache ? undefined : new EnhancedSqlCache();

    // Store performance options; auto-inject per-context count cache when none supplied.
    // Preserve the original ternary form to avoid exposing a pre-existing CountCache ↔
    // InMemoryCountCache type mismatch to TypeScript's widening rules.
    this._performanceOptions = options.performance?.countCache
      ? options.performance
      : { ...options.performance, countCache: new InMemoryCountCache() };

    // Inject owned SQL cache without touching the countCache assignment above.
    if (this._ownedSqlCache) {
      this._performanceOptions = { ...this._performanceOptions, sqlCache: this._ownedSqlCache };
    }

    this._cacheCoordinator = new CacheCoordinator(
      this._entityCache,
      this._performanceOptions?.sqlCache,
      this._performanceOptions?.countCache,
      this._provider.providerLabel,
      this._performanceOptions?.cacheNamespace,
      this._registry,
      (ec) => this._registry.getEntity(ec)?.primaryKeys?.[0]
    );

    this._auditInterceptor = new AuditInterceptor(options.audit, (ec) =>
      this._registry.getEntity(ec)
    );

    this._softDeleteInterceptor = new SoftDeleteInterceptor(
      options.softDelete,
      (ec) => this._registry.getEntity(ec),
      async (entity, cls) => {
        await this._provider.update(entity, cls);
      },
      (c) => this._cacheCoordinator.updateEntry(c)
    );

    // Build InterceptorRegistry from built-in + user-supplied interceptors.
    // Built-in interceptors are added only when their respective feature is enabled.
    const builtIn: object[] = [];
    if (options.audit?.enabled) builtIn.push(this._auditInterceptor);
    if (options.softDelete?.enabled) builtIn.push(this._softDeleteInterceptor);
    this._interceptorRegistry = new InterceptorRegistry([
      ...builtIn,
      ...(options.interceptors ?? [])
    ]);

    // Configure provider with partitioned interceptors.
    this._provider.configureInterceptors({
      command: this._interceptorRegistry.forEachCommand(),
      connection: this._interceptorRegistry.forEachConnection(),
      transaction: this._interceptorRegistry.forEachTransaction(),
      materialization: this._interceptorRegistry.forEachMaterialization()
    });

    // Propagate query performance analysis options into provider if available
    const analysis = options.performance?.analysis;
    if (analysis) {
      this._provider.configureQueryAnalysis(analysis);
    }
    // Apply configurable IN() chunk size into loader
    this._entityLoader.setInChunkSize(this._performanceOptions?.inClauseChunkSize);
    this._loadingDefaults = options.loading || {};

    // Apply loading strategy from options or keep default
    if (this._loadingDefaults.strategy) {
      this._defaultLoadingStrategy = this._loadingDefaults.strategy;
      this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
    } else {
      this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
    }

    const modelBuilder = new ModelBuilder(this._registry);
    this.onModelCreating(modelBuilder);
    modelBuilder._finalize();
    this._entityQueryFilterMap = modelBuilder._getQueryFilterMap();

    this.initializeDbSets();
    this._database = new DatabaseFacade(this.buildDbSetContext(), options.migrationsDirectory);
  }

  /**
   * Override in subclasses to apply fluent model configuration.
   * Mirrors EF Core's DbContext.OnModelCreating(ModelBuilder).
   *
   * Called once in the constructor after decorator metadata is settled.
   * Fluent configuration applied here overrides decorator-defined metadata.
   */
  protected onModelCreating(_modelBuilder: ModelBuilder): void {
    // Default: no-op.
  }

  /**
   * Provides access to database-level raw SQL operations (non-entity-bound queries,
   * non-query commands). Mirrors EF Core's `context.Database` property.
   */
  get database(): DatabaseFacade {
    return this._database;
  }

  /**
   * Get a DbSet for the specified entity type
   *
   * @param entityClass Constructor of the entity type.
   * @returns Configured `DbSet` instance.
   */
  public set<T extends object>(entityClass: new () => T): DbSet<T> {
    const maybe = reflectGetOwnMetadata('orm:original', entityClass);
    const normalized = typeof maybe === 'function' ? maybe : entityClass;
    if (!this._dbSets.has(normalized)) {
      throw new Error(`DbSet for ${entityClass.name} is not configured`);
    }
    // Fast path: no decoration — return the shared instance unchanged
    if ((entityClass as unknown) === normalized) {
      return this._dbSets.get(normalized) as unknown as DbSet<T>;
    }
    // Decorated class: return a scoped DbSet that uses the decorated constructor.
    // Cached to avoid allocating on every call.
    if (!this._decoratedDbSets.has(entityClass)) {
      this._decoratedDbSets.set(
        entityClass,
        new DbSet<object>(entityClass, this.buildDbSetContext())
      );
    }
    return this._decoratedDbSets.get(entityClass) as unknown as DbSet<T>;
  }

  /**
   * Create and register a typed DbSet for the given entity class.
   *
   * Use this inside subclass property initialisers in place of the old
   * `new DbSet(Entity)` syntax:
   *
   * @example
   * class AppCtx extends DbContext {
   *   users = this.defineSet(User);
   *   posts = this.defineSet(Post);
   * }
   *
   * Because derived-class field initialisers run *after* `super()` returns,
   * `this` is already fully initialised when `defineSet` is called — no Proxy
   * interception is required.
   *
   * @param entityClass  Entity constructor (required — generics are erased at runtime).
   * @returns A fully configured and context-injected `DbSet<T>`.
   */
  protected defineSet<T extends object>(entityClass: new () => T): DbSet<T> {
    const original = getOriginal(entityClass);
    if (this._dbSets.has(original)) {
      return this._dbSets.get(original) as unknown as DbSet<T>;
    }
    // Entity not yet in the registry (dynamic registration after construction).
    const dbSet = new DbSet<T>(entityClass, this.buildDbSetContext());
    this._dbSets.set(original as unknown as Function, dbSet as unknown as DbSet<object>);
    return dbSet;
  }

  /**
   * Initialize the database and create tables
   *
   * Connects the provider and creates tables for all registered entities.
   */
  public async ensureCreated(): Promise<void> {
    await this._provider.connect();

    // Unconditionally pre-warm Stage-3 field decorators by instantiating each entity once
    const prereg = this._registry.getEntities();
    for (const e of prereg) {
      try {
        if (!e.target) continue;
        const original = getOriginal(e.target);

        const _tmp = new (original as unknown as new () => unknown)();
      } catch {
        // ignore constructors with side-effects/args
      }
    }
    const entities = this._registry.getEntities();

    for (const entity of entities) {
      await this._provider.createTable(entity);
    }
  }

  /**
   * Save all changes tracked by the change tracker.
   * Similar to Entity Framework's SaveChanges().
   *
   * When called outside an active transaction, `saveChanges()` opens its own
   * transaction, commits on success, and rolls back on error.
   *
   * When called inside a caller-managed transaction (after `beginTransaction()`),
   * `saveChanges()` participates in that transaction without opening a nested one.
   * The caller is responsible for calling `commitTransaction()` or
   * `rollbackTransaction()`. If `saveChanges()` throws, the change tracker is
   * NOT reset — the caller should roll back and handle the error.
   *
   * @returns Number of affected rows.
   */
  public async saveChanges(): Promise<number> {
    this._changeTracker.detectChanges();
    this._changeTracker.applyCascades();
    const changes = this._changeTracker.getChanges();
    if (!changes || changes.length === 0) return 0;
    this.prefillDefaults(changes);
    const normalizedForValidation = this.normalizeForValidation(changes);
    this._validationService.validate(normalizedForValidation);
    const normalizedForInvalidation = normalizedForValidation.map((c) => ({
      entity: c.entity,
      entityClass: c.entityClass,
      state: c.state
    }));

    // Build event data for the ISaveChangesInterceptor pipeline.
    const entries = changes.map((c) => ({
      entity: c.entity,
      entityClass: c.entityClass,
      state: c.state
    }));
    const eventData: SaveChangesEventData = { entityCount: entries.length, entries };

    // savingChanges — interceptors may short-circuit the entire operation
    const saveChangesInterceptors = this._interceptorRegistry.forEachSaveChanges();
    let suppressResult = InterceptionResult.NoResult<number>();
    for (const ic of saveChangesInterceptors) {
      const r = await ic.savingChanges?.(eventData, suppressResult);
      if (r) suppressResult = r;
      if (suppressResult.isSuppressed) return suppressResult.result ?? 0;
    }

    const ownTransaction = !this.isInTransaction;
    if (ownTransaction) {
      await this._provider.beginTransaction();
    }
    try {
      let affectedRows = 0;
      if (this._maxBatchSize > 0) {
        const allNormalized = changes.map((c) => this.normalizeChange(c));
        const batchExecutor = new BatchExecutor(this._provider, this._maxBatchSize, this._registry);
        affectedRows = await batchExecutor.execute(allNormalized);
      } else {
        for (const change of changes) {
          const normalized = this.normalizeChange(change);
          affectedRows += await this.processChange(normalized);
        }
      }

      // Process many-to-many skip navigation join-row inserts/deletes
      const skipNavChanges = this._changeTracker.collectSkipNavigationChanges();
      affectedRows += await this._applySkipNavigationChanges(skipNavChanges);

      if (ownTransaction) {
        await this._provider.commitTransaction();
      }
      this._cacheCoordinator.invalidateAfterMutation(normalizedForInvalidation);
      this._changeTracker.acceptAllChanges();

      // savedChanges — interceptors may adjust the final row count
      let result = affectedRows;
      for (const ic of saveChangesInterceptors) {
        const r = await ic.savedChanges?.(eventData, result);
        if (r !== undefined) result = r;
      }
      return result;
    } catch (error) {
      if (ownTransaction) {
        await this._provider.rollbackTransaction();
      }
      // saveChangesFailed — notify interceptors of the failure
      for (const ic of saveChangesInterceptors) {
        await ic.saveChangesFailed?.(eventData, error as Error);
      }
      if (error instanceof OptimisticConcurrencyError) {
        const failedEntries = changes.map(
          (c) => new EntityEntry(c.entity, c.entityClass, this._provider)
        );
        throw new DbUpdateConcurrencyException(error.message, failedEntries);
      }
      throw error;
    }
  }

  /**
   * Returns an EntityEntry for the given tracked entity, providing access to
   * state, shadow property values, and database reload.
   * Mirrors EF Core's DbContext.Entry<T>(entity).
   */
  public entry<T extends object>(entity: T): EntityEntry<T> {
    return new EntityEntry<T>(
      entity,
      entity.constructor as Function,
      this._provider,
      this._changeTracker
    );
  }

  /** Try-version of saveChanges without throwing exceptions. */
  public async trySaveChanges(): Promise<Result<number, Error>> {
    try {
      const affected = await this.saveChanges();
      return ok(affected);
    } catch (e: unknown) {
      return err(e as Error);
    }
  }

  /** Whether a caller-managed transaction is currently active on this context. */
  public get isInTransaction(): boolean {
    return this._transactionDepth > 0;
  }

  /**
   * Start a database transaction.
   * Increments the internal transaction depth counter so that subsequent
   * `saveChanges()` calls participate in this transaction instead of opening
   * their own.
   *
   * Nested calls (depth > 0) are silently absorbed — only the outermost call
   * opens a real provider transaction. This mirrors EF Core's TransactionScope
   * semantics and allows service-layer code to be transaction-agnostic.
   */
  public async beginTransaction(): Promise<void> {
    if (this._transactionDepth === 0) {
      await this._provider.beginTransaction();
    }
    this._transactionDepth++;
  }

  /**
   * Commit the current transaction.
   * Decrements the transaction depth counter. The real provider commit is
   * issued only when the outermost transaction (depth 1 → 0) is committed.
   */
  public async commitTransaction(): Promise<void> {
    if (this._transactionDepth <= 1) {
      await this._provider.commitTransaction();
      this._transactionDepth = 0;
      try {
        this._cacheCoordinator.invalidateOnCommit();
        if (this._entityCache) {
          safeCacheSize(this._provider.loggerRef, {
            cache: 'entityL2',
            size: this._entityCache.size?.() ?? -1,
            provider: this._provider.providerLabel
          });
        }
      } catch (e) {
        // logInternalError('DbContext.commitTransaction.invalidateCaches', e);
      }
    } else {
      this._transactionDepth--;
    }
  }

  /**
   * Rollback the current transaction.
   * Resets the transaction depth counter to zero unconditionally.
   */
  public async rollbackTransaction(): Promise<void> {
    await this._provider.rollbackTransaction();
    this._transactionDepth = 0;
    this._cacheCoordinator.clearAll();
    if (this._entityCache) {
      try {
        safeCacheSize(this._provider.loggerRef, {
          cache: 'entityL2',
          size: this._entityCache.size?.() ?? 0,
          provider: this._provider.providerLabel
        });
      } catch (e) {
        // logInternalError('DbContext.rollbackTransaction.entityCacheClear', e);
      }
    }
  }

  /** Simple cache utilities (warm-up etc.). */
  public readonly cache = {
    warmUp: async (
      options: {
        queries?: ReadonlyArray<() => Promise<unknown> | unknown>;
      } = {}
    ): Promise<void> => {
      const tasks = (options.queries || []).map(async (fn) => {
        try {
          await fn();
        } catch (e) {
          // logInternalError('DbContext.cache.warmUp.task', e);
        }
      });
      await Promise.all(tasks);
    },
    invalidateByEntity: (entityNames: ReadonlyArray<string>): void => {
      this._cacheCoordinator.invalidateByEntityNames(entityNames);
    },
    reportMetrics: (): void => {
      try {
        const sqlMetrics = this._ownedSqlCache?.getMetrics?.();
        const countCache = this._performanceOptions?.countCache;
        const countMetrics = countCache?.getMetrics?.();
        const logger = this._provider.loggerRef;
        if (sqlMetrics)
          logger?.cacheSize?.({
            cache: 'sqlGen',
            size: sqlMetrics.currentSize ?? -1,
            provider: this._provider.providerLabel
          });
        if (countMetrics)
          logger?.cacheSize?.({
            cache: 'count',
            size: countMetrics.currentSize ?? -1,
            provider: this._provider.providerLabel
          });
        if (this._entityCache)
          logger?.cacheSize?.({
            cache: 'entityL2',
            size: this._entityCache.size?.() ?? -1,
            provider: this._provider.providerLabel
          });
      } catch (e) {
        // logInternalError('DbContext.cache.reportMetrics', e);
      }
    }
  } as const;

  /**
   * Dispose of the database connection
   */
  public async dispose(): Promise<void> {
    await this._provider.disconnect();
    this._ownedSqlCache?.dispose();
    // Stop external memory profiler if started
    try {
      this._memoryProfiler?.stop?.();
    } catch (e) {
      // logInternalError('DbContext.dispose.memoryProfiler.stop', e);
    }
  }

  /**
   * Reset all mutable per-request state so this instance can be safely
   * re-used by a subsequent unit-of-work.
   *
   * Called automatically by `DbContextPool` before returning an idle
   * context to the pool. **Do not call this from application code** unless
   * you are building your own pooling layer.
   *
   * Clears:
   * - `ChangeTracker` — all tracked entities and their snapshots.
   * - L2 entity / SQL / count caches — via `CacheCoordinator.clearAll()`.
   * - Transaction depth counter — resets nested-transaction bookkeeping.
   */
  public reset(): void {
    this._changeTracker.clear();
    this._cacheCoordinator.clearAll();
    this._transactionDepth = 0;
  }

  /**
   * Support `await using ctx = ...` syntax (TC39 Explicit Resource Management).
   *
   * When this context was leased from a `DbContextPool`, the pool return hook
   * is invoked instead of a full disconnect, recycling the instance.
   * For non-pooled contexts this is equivalent to calling `dispose()`.
   */
  public async [Symbol.asyncDispose](): Promise<void> {
    if (this._returnToPool) {
      await this._returnToPool();
    } else {
      await this.dispose();
    }
  }

  /**
   * Register a callback that replaces `dispose()` when `Symbol.asyncDispose`
   * is triggered.
   *
   * **For internal use by `PooledDbContextFactory` only.**
   * Calling this from application code produces undefined behaviour.
   *
   * @internal
   * @param fn - Async callback that returns the context to the pool.
   */
  _setPoolReturnHook(fn: () => Promise<void>): void {
    this._returnToPool = fn;
  }

  /**
   * Get the underlying database provider
   *
   * @returns The active `DatabaseProvider` implementation.
   */
  protected get provider(): DatabaseProvider {
    return this._provider;
  }

  /**
   * Get the change tracker.
   *
   * Mirrors EF Core's `DbContext.ChangeTracker` public property.
   * Use to inspect tracked entities, call `detectChanges()`, or `clear()`.
   *
   * @returns The `ChangeTracker` handling entity states for this context.
   */
  public get changeTracker(): ChangeTracker {
    return this._changeTracker;
  }

  /**
   * Get the entity loader
   *
   * @returns The `EntityLoader` used for eager/lazy loading.
   */
  protected get entityLoader(): EntityLoader {
    return this._entityLoader;
  }

  /**
   * Set the default loading strategy
   *
   * @param strategy Loading strategy to use by default.
   */
  public setLoadingStrategy(strategy: LoadingStrategy): void {
    this._defaultLoadingStrategy = strategy;
    this._entityLoader.setDefaultStrategy(strategy);
  }

  /**
   * Find an entity by ID with loading options.
   * Entity Framework style method that returns lazy loading proxies by default.
   *
   * @param entityClass Constructor of the entity type.
   * @param id Primary key value.
   * @param options Loading options (strategy, includes, depth).
   * @returns The found entity or null with lazy loading enabled by default.
   */
  public async find<T extends object>(
    entityClass: new () => T,
    id: unknown,
    options?: LoadingOptions
  ): Promise<T | null> {
    const loadingOptions = {
      strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
      depth: this._loadingDefaults.depth ?? options?.depth,
      ...(options || {})
    };
    return await this._entityLoader.loadEntity<T>(entityClass, id, loadingOptions);
  }

  /**
   * Find entities with loading options.
   * Entity Framework style method that returns lazy loading proxies by default.
   *
   * @param entityClass Constructor of the entity type.
   * @param options Loading options (strategy, includes, depth).
   * @returns Array of loaded entities with lazy loading enabled by default.
   */
  public async findAll<T extends object>(
    entityClass: new () => T,
    options?: LoadingOptions
  ): Promise<T[]> {
    const loadingOptions = {
      strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
      depth: this._loadingDefaults.depth ?? options?.depth,
      ...(options || {})
    };
    return await this._entityLoader.loadEntities<T>(entityClass, loadingOptions);
  }

  /**
   * Load navigation properties for an entity (Entity Framework style Include).
   * Useful for explicitly loading relationships on already-loaded entities.
   */
  public async include<T extends object>(
    entity: T,
    entityClass: new () => T,
    ...propertyNames: string[]
  ): Promise<void> {
    if (LazyLoadingProxy.isLazyProxy(entity)) {
      // Preload relationships for lazy proxy
      await LazyLoadingProxy.preloadRelationships(
        [entity],
        entityClass,
        propertyNames,
        this._provider
      );
    } else {
      // Use entity loader for regular entities
      await this._entityLoader.populateRelationships(entity, entityClass, {
        strategy: LoadingStrategy.Eager,
        includes: propertyNames
      });
    }
  }

  /**
   * Check if navigation property is loaded (Entity Framework style IsLoaded).
   */
  public isLoaded<T extends object>(entity: T, propertyName: string): boolean {
    if (LazyLoadingProxy.isLazyProxy(entity)) {
      return LazyLoadingProxy.isRelationshipLoaded(entity, propertyName);
    }
    // For non-proxy entities, check if property key exists (even if undefined/null)
    const record = entity as unknown as Record<string, unknown>;
    return propertyName in record;
  }

  // Removed string-based include API in favor of predicate-based include on Queryable

  /**
   * Initialize DbSets for all registered entities.
   *
   * This method also defines auto-generated properties on the context instance
   * for each entity using a simple naming convention (see class JSDoc). If your
   * code expects different names, prefer `set(Entity)` or add your own proxy
   * getters that delegate to `set(Entity)`.
   */
  private buildDbSetContext(): DbSetContext {
    return {
      provider: this._provider,
      changeTracker: this._changeTracker,
      entityLoader: this._entityLoader,
      entityCache: this._entityCache,
      performance: this._performanceOptions,
      globalFilters: this._globalFilters,
      softDeleteOptions: this._softDelete,
      querySplittingBehavior: this._querySplittingBehavior,
      beginTransaction: async () => this.beginTransaction(),
      commitTransaction: async () => this.commitTransaction(),
      rollbackTransaction: async () => this.rollbackTransaction(),
      executionStrategyOptions: this._executionStrategyOptions,
      entityQueryFilterMap: this._entityQueryFilterMap
    };
  }

  private initializeDbSets(): void {
    const entities = this._registry.getEntities();

    for (const entity of entities) {
      if (!entity.target) continue;
      const original = getOriginal(entity.target);
      const dbSet = new DbSet<object>(
        original as unknown as new () => object,
        this.buildDbSetContext()
      );
      this._dbSets.set(original, dbSet);

      // Create a writable, configurable data property for easy access.
      // Writable so that subclass field initialisers (e.g. `users = this.defineSet(User)`)
      // can overwrite it without throwing "property has only a getter".
      const base = original.name.toLowerCase();
      const propertyName = base.endsWith('y') ? base.slice(0, -1) + 'ies' : base + 's';
      Object.defineProperty(this, propertyName, {
        value: dbSet,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }

  private prefillDefaults(
    changes: Array<{ entity: object; entityClass: Function; state: string }>
  ): void {
    for (const change of changes) {
      if (change.state !== 'added') continue;
      const meta = this._registry.getEntity(change.entityClass);
      if (!meta) continue;
      for (const col of meta.columns) {
        const record = change.entity as Record<string, unknown>;
        if (record[col.propertyName] === undefined && col.defaultValue !== undefined) {
          record[col.propertyName] = col.defaultValue;
        }
      }
    }
  }

  private normalizeForValidation(
    changes: Array<{
      entity: object;
      entityClass: Function;
      state: string;
      originalValues?: object;
    }>
  ): Array<{
    entity: Record<string, unknown>;
    entityClass: Function;
    state: string;
    originalValues?: object;
  }> {
    return changes.map((c) => ({
      entity: c.entity as Record<string, unknown>,
      entityClass: c.entityClass,
      state: c.state,
      originalValues: c.originalValues
    }));
  }

  private normalizeChange(change: {
    entity: object;
    entityClass: Function;
    state: string;
    originalValues?: object;
  }): {
    entity: Record<string, unknown>;
    entityClass: Function;
    state: string;
    originalValues?: object;
  } {
    const shadowValues = this._changeTracker.getShadowValues(change.entity);
    const entity =
      shadowValues && shadowValues.size > 0
        ? { ...(change.entity as Record<string, unknown>), ...Object.fromEntries(shadowValues) }
        : (change.entity as Record<string, unknown>);

    return {
      entity,
      entityClass: change.entityClass,
      state: change.state,
      originalValues: change.originalValues
    };
  }

  private async _applySkipNavigationChanges(changes: JoinRowChange[]): Promise<number> {
    let count = 0;
    for (const change of changes) {
      if (change.operation === 'insert') {
        await this._provider.insert(change.joinRow, change.joinEntityCtor);
      } else {
        await this._provider.delete(change.joinRow, change.joinEntityCtor);
      }
      count++;
    }
    return count;
  }

  private async processChange(change: NormalizedChange): Promise<number> {
    switch (change.state) {
      case 'added':
        await this.applyInsert(change);
        return 1;
      case 'modified':
        await this.applyUpdate(change);
        return 1;
      case 'deleted':
        return (await this.applyDelete(change)) ? 1 : 0;
      default:
        return 0;
    }
  }

  private async applyInsert(
    change: Pick<NormalizedChange, 'entity' | 'entityClass'>
  ): Promise<void> {
    // Primary table insert (normal path).
    await this._insertCmd.execute({ ...change, state: 'added' });

    // Entity splitting: insert into each secondary fragment table.
    const meta = this._registry.getEntity(change.entityClass);
    if (meta?.tableFragments?.length) {
      for (const fragment of meta.tableFragments) {
        await this._fragmentExecutor.insertFragment(change.entity, meta, fragment);
      }
    }
  }

  private async applyUpdate(
    change: Pick<NormalizedChange, 'entity' | 'entityClass' | 'originalValues'>
  ): Promise<void> {
    // Primary table update (normal path).
    await this._updateCmd.execute({ ...change, state: 'modified' });

    // Entity splitting: update each secondary fragment table.
    const meta = this._registry.getEntity(change.entityClass);
    if (meta?.tableFragments?.length) {
      for (const fragment of meta.tableFragments) {
        await this._fragmentExecutor.updateFragment(
          change.entity,
          meta,
          fragment,
          change.originalValues
        );
      }
    }
  }

  private async applyDelete(
    change: Pick<NormalizedChange, 'entity' | 'entityClass' | 'originalValues'>
  ): Promise<boolean> {
    // Entity splitting: delete from secondary fragments first (reverse order) before primary.
    const meta = this._registry.getEntity(change.entityClass);
    if (meta?.tableFragments?.length) {
      for (const fragment of [...meta.tableFragments].reverse()) {
        await this._fragmentExecutor.deleteFragment(
          change.entity,
          meta,
          fragment,
          change.originalValues
        );
      }
    }

    return await this._deleteCmd.execute({ ...change, state: 'deleted' });
  }

  private getPrimaryKey(entityClass: Function): string | undefined {
    const meta = this._registry.getEntity(entityClass);
    return meta?.primaryKeys?.[0];
  }
}
