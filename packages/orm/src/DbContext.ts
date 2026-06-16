import type { DatabaseProvider } from '@ts-linq/core';
import type { LoadingOptions } from '@ts-linq/core';
import type { DbContextOptions, MemoryProfilerLike } from '@ts-linq/core';
import type { EntityLoader } from '@ts-linq/core';
import { LoadingStrategy } from '@ts-linq/core';
import { LazyLoadingProxy } from '@ts-linq/core';
import type { MetadataRegistry } from '@ts-linq/metadata';
import { type EnhancedSqlCache } from '@ts-linq/query/internal';
import type { EntityCtorRef } from '@ts-linq/types';
import type {
  ExecutionStrategyOptions,
  GlobalFilter,
  PerformanceOptions,
  QuerySplittingBehavior,
  Result,
  SoftDeleteOptions
} from '@ts-linq/types';
import type { EntityCacheLike, LoadingDefaults } from '@ts-linq/types';
import { err, ok } from '@ts-linq/types';

import { EntityEntry } from './changetracker/EntityEntry';
import { type ChangeTrackerFacade } from './ChangeTrackerFacade';
import { type DeleteCommand } from './commands/DeleteCommand';
import { type FragmentDmlExecutor } from './commands/FragmentDmlExecutor';
import { type InsertCommand } from './commands/InsertCommand';
import { type UpdateCommand } from './commands/UpdateCommand';
import { ChangeExecutor } from './context/ChangeExecutor';
import { DbContextBootstrapper } from './context/DbContextBootstrapper';
import type { DbContextServices } from './context/DbContextServices';
import { DbSetRegistry } from './context/DbSetRegistry';
import { type DiagnosticSink } from './context/DiagnosticSink';
import { getOriginal } from './context/entityOriginal';
import { SaveChangesPipeline } from './context/save-pipeline/SaveChangesPipeline';
import { TransactionScope } from './context/TransactionScope';
import { ValueGenerationService } from './context/ValueGenerationService';
import { DatabaseFacade } from './DatabaseFacade';
import { type DbSet } from './DbSet';
import { type InterceptorRegistry } from './interceptors/InterceptorRegistry';
import { type EntityQueryFilterMap, type ModelBuilder } from './ModelBuilder';
import { type SpExecutor } from './save-changes/sp-executor';
import { type CacheCoordinator } from './services/CacheCoordinator';
import { type ChangeValidationService } from './services/ChangeValidationService';

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
  /** All built collaborators + resolved options (see {@link DbContextBootstrapper}). */
  private readonly _services: DbContextServices;

  // ── Extracted collaborators ──
  private readonly _dbSetRegistry: DbSetRegistry;
  private readonly _valueGen: ValueGenerationService;
  private readonly _changeExecutor: ChangeExecutor;
  private readonly _transactionScope: TransactionScope;
  private readonly _saveChangesPipeline: SaveChangesPipeline;

  // ── Mutable per-context facade state (not owned by the services value object) ──
  private _defaultLoadingStrategy: LoadingStrategy;
  private _database!: DatabaseFacade;
  /** @internal Callback set by a pooled factory; overrides dispose to return context to pool. */
  private _returnToPool?: () => Promise<void>;

  // ── Read-only accessors delegating to the services value object ──
  private get _provider(): DatabaseProvider {
    return this._services.provider;
  }
  private get _registry(): MetadataRegistry {
    return this._services.registry;
  }
  private get _changeTracker(): ChangeTrackerFacade {
    return this._services.changeTracker;
  }
  private get _entityLoader(): EntityLoader {
    return this._services.entityLoader;
  }
  private get _entityCache(): EntityCacheLike | undefined {
    return this._services.entityCache;
  }
  private get _performanceOptions(): PerformanceOptions | undefined {
    return this._services.performanceOptions;
  }
  private get _loadingDefaults(): LoadingDefaults {
    return this._services.loadingDefaults;
  }
  private get _softDelete(): SoftDeleteOptions | undefined {
    return this._services.softDelete;
  }
  private get _globalFilters(): GlobalFilter[] | undefined {
    return this._services.globalFilters;
  }
  private get _entityQueryFilterMap(): EntityQueryFilterMap {
    return this._services.entityQueryFilterMap;
  }
  private get _memoryProfiler(): MemoryProfilerLike | undefined {
    return this._services.memoryProfiler;
  }
  private get _validationService(): ChangeValidationService {
    return this._services.validationService;
  }
  private get _insertCmd(): InsertCommand {
    return this._services.insertCmd;
  }
  private get _updateCmd(): UpdateCommand {
    return this._services.updateCmd;
  }
  private get _deleteCmd(): DeleteCommand {
    return this._services.deleteCmd;
  }
  private get _fragmentExecutor(): FragmentDmlExecutor {
    return this._services.fragmentExecutor;
  }
  private get _spExecutor(): SpExecutor {
    return this._services.spExecutor;
  }
  private get _ownedSqlCache(): EnhancedSqlCache | undefined {
    return this._services.ownedSqlCache;
  }
  private get _querySplittingBehavior(): QuerySplittingBehavior | undefined {
    return this._services.querySplittingBehavior;
  }
  private get _cacheCoordinator(): CacheCoordinator {
    return this._services.cacheCoordinator;
  }
  private get _diagnosticSink(): DiagnosticSink {
    return this._services.diagnosticSink;
  }
  private get _interceptorRegistry(): InterceptorRegistry {
    return this._services.interceptorRegistry;
  }
  private get _executionStrategyOptions(): ExecutionStrategyOptions | undefined {
    return this._services.executionStrategyOptions;
  }
  private get _maxBatchSize(): number {
    return this._services.maxBatchSize;
  }

  /**
   * Create a new database context instance.
   *
   * @param options Connection and provider configuration.
   */
  constructor(options: DbContextOptions) {
    // All collaborator wiring + cache/performance defaulting lives in the
    // bootstrapper; the constructor stays free of inline branches.
    this._services = DbContextBootstrapper.bootstrap(options, (mb) => this.onModelCreating(mb));
    this._defaultLoadingStrategy = this._services.defaultLoadingStrategy;
    this._valueGen = new ValueGenerationService(this._services.registry, this._services.provider);
    this._changeExecutor = new ChangeExecutor(this._services);
    this._transactionScope = new TransactionScope(this._services);
    this._saveChangesPipeline = new SaveChangesPipeline({
      provider: this._services.provider,
      changeTracker: this._services.changeTracker,
      valueGen: this._valueGen,
      validationService: this._services.validationService,
      interceptorRegistry: this._services.interceptorRegistry,
      changeExecutor: this._changeExecutor,
      cacheCoordinator: this._services.cacheCoordinator,
      transactionScope: this._transactionScope
    });
    this._dbSetRegistry = new DbSetRegistry(this._services, {
      beginTransaction: async () => this.beginTransaction(),
      commitTransaction: async () => this.commitTransaction(),
      rollbackTransaction: async () => this.rollbackTransaction()
    });

    this._dbSetRegistry.initialize(this);
    this._database = new DatabaseFacade(
      this._dbSetRegistry.buildDbSetContext(),
      options.migrationsDirectory
    );
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
    return this._dbSetRegistry.set(entityClass);
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
    return this._dbSetRegistry.defineSet(entityClass);
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
      } catch (e) {
        // Best-effort pre-warm: entity constructors with required args / side
        // effects legitimately fail here, so we recover and continue — but log
        // at debug so a genuine model-misconfiguration is not fully hidden.
        this._diagnosticSink.internalDiag('DbContext.ensureCreated.instantiate', e, 'debug');
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
    return this._saveChangesPipeline.run();
  }

  /**
   * Returns an EntityEntry for the given tracked entity, providing access to
   * state, shadow property values, and database reload.
   * Mirrors EF Core's DbContext.Entry<T>(entity).
   */
  public entry<T extends object>(entity: T): EntityEntry<T> {
    return new EntityEntry<T>(
      entity,
      entity.constructor as EntityCtorRef,
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
    return this._transactionScope.isActive;
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
    await this._transactionScope.begin();
  }

  /**
   * Commit the current transaction.
   * Decrements the transaction depth counter. The real provider commit is
   * issued only when the outermost transaction (depth 1 → 0) is committed.
   */
  public async commitTransaction(): Promise<void> {
    await this._transactionScope.commit();
  }

  /**
   * Rollback the current transaction.
   * Resets the transaction depth counter to zero unconditionally.
   */
  public async rollbackTransaction(): Promise<void> {
    await this._transactionScope.rollback();
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
          // Warm-up is best-effort: a failing pre-fetch must not reject the
          // batch. Log at debug and continue.
          this._diagnosticSink.internalDiag('DbContext.cache.warmUp.task', e, 'debug');
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
        // Telemetry-only metrics readout: log and continue, never throw.
        this._diagnosticSink.internalDiag('DbContext.cache.reportMetrics', e);
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
      // Cleanup-with-swallow during dispose: log at warn, never rethrow so the
      // rest of teardown still runs.
      this._diagnosticSink.internalDiag('DbContext.dispose.memoryProfiler.stop', e);
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
    this._transactionScope.reset();
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
  public get changeTracker(): ChangeTrackerFacade {
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
      // Preload relationships for lazy proxy. Lazy-loading warnings stay silent
      // unless the host attached a logger via `options.logging`; route them to
      // that sink explicitly (composition-root opt-in).
      const contextLogger = this._provider.loggerRef;
      const lazyLogger = contextLogger
        ? { warn: (message: string, error?: unknown) => contextLogger.warn(message, { error }) }
        : undefined;
      await LazyLoadingProxy.preloadRelationships(
        [entity],
        entityClass,
        propertyNames,
        this._provider,
        this._registry,
        lazyLogger
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
}
