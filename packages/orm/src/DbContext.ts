import type { DatabaseProvider } from '@ts-linq/core';
import { ChangeTracker } from './ChangeTracker';
import { EntityLoader } from '@ts-linq/core';
import type { LoadingOptions } from '@ts-linq/core';
import { LoadingStrategy } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { LazyLoadingProxy } from '@ts-linq/core';
import { DbSet } from './DbSet';
import { InsertCommand } from './commands/InsertCommand';
import { UpdateCommand } from './commands/UpdateCommand';
import { DeleteCommand } from './commands/DeleteCommand';
import { ChangeValidationService } from './services/ChangeValidationService';
import type {
  PerformanceOptions,
  Result,
  SoftDeleteOptions,
  GlobalFilter
} from '@ts-linq/types';
import type { 
  DbContextOptions,
  LoadingDefaults,
  AuditOptions,
  DiagnosticsOptions, 
  MemoryProfilerLike 
} from '@ts-linq/core';
import { ok, err, ValidationError } from '@ts-linq/types';
import type { EntityCacheLike } from '@ts-linq/core';
import { EntityCache } from '@ts-linq/core';
// import { logInternalError } from '@ts-linq/core'; // REMOVED

function getOriginal<T extends Function>(target: T): T {
  try {
    const gm = (Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown })
      .getOwnMetadata;
    const original = (gm?.('orm:original', target) as T | undefined) || target;
    return original;
  } catch {
    return target;
  }
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
  private _changeTracker: ChangeTracker;
  private _entityLoader: EntityLoader;
  private _dbSets: Map<Function, DbSet<object>> = new Map();
  private _defaultLoadingStrategy: LoadingStrategy = LoadingStrategy.Eager;
  private _entityCache?: EntityCacheLike;
  private _performanceOptions?: PerformanceOptions;
  private _loadingDefaults: LoadingDefaults = {};
  private _softDelete?: SoftDeleteOptions;
  private _audit?: AuditOptions;
  private _globalFilters?: GlobalFilter[];
  private _diagnostics?: DiagnosticsOptions;
  private _memoryProfiler?: MemoryProfilerLike;
  private _validationOptions?: {
    translate?: (key: string, params?: Record<string, unknown>) => string;
  };
  private _validationService!: ChangeValidationService;
  private _insertCmd!: InsertCommand;
  private _updateCmd!: UpdateCommand;
  private _deleteCmd!: DeleteCommand;
  /** Cache of validation rules per entity class to avoid repeated metadata lookups. */
  private _validationRulesCache: WeakMap<
    Function,
    Array<{ propertyName: string; predicate: (e: unknown) => boolean; message?: string }>
  > = new WeakMap();

  /**
   * Create a new database context instance.
   *
   * @param options Connection and provider configuration.
   */
  constructor(options: DbContextOptions) {
    // Initialize database provider from options
    this._provider = options.provider;
    this._softDelete = options.softDelete;
    // Propagate soft-delete settings into provider for GlobalFilterApplier and ProviderStub
    try {
      (this._provider as unknown as { softDelete?: SoftDeleteOptions }).softDelete =
        options.softDelete;
    } catch {
      /* ignore */
    }
    this._audit = options.audit;
    this._globalFilters = options.globalFilters as any;
    this._diagnostics = options.diagnostics;
    // Start external memory profiler if provided
    try {
      const mp = this._diagnostics?.memoryProfiler;
      if (mp) {
        this._memoryProfiler = mp;
        mp.start?.();
      }
    } catch (e) {
      // logInternalError('DbContext.constructor.memoryProfiler.start', e);
    }
    this._validationOptions = options.validation;
    this._validationService = new ChangeValidationService(
      this._validationOptions?.translate,
      this._audit
    );

    this._changeTracker = new ChangeTracker();
    this._entityLoader = new EntityLoader(this._provider);
    this._insertCmd = new InsertCommand(this._provider, (c) => this.updateEntityCache(c));
    this._updateCmd = new UpdateCommand(this._provider, (c) => this.updateEntityCache(c));
    this._deleteCmd = new DeleteCommand(
      this._provider,
      (c: any) => this.handleSoftDelete(c),
      (c: any) => this.removeFromEntityCache(c)
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
    // Store performance options for downstream consumers
    this._performanceOptions = options.performance as any;
    // Propagate query performance analysis options into provider if available
    try {
      const analysis = options.performance?.analysis;
      if (
        analysis &&
        typeof (this._provider as unknown as { configureQueryAnalysis?: (o: unknown) => void })
          .configureQueryAnalysis === 'function'
      ) {
        (
          this._provider as unknown as { configureQueryAnalysis: (o: unknown) => void }
        ).configureQueryAnalysis(analysis as unknown);
      }
    } catch {
      /* ignore */
    }
    // Apply configurable IN() chunk size into loader
    this._entityLoader.setInChunkSize((this._performanceOptions as any)?.inClauseChunkSize);
    this._loadingDefaults = options.loading || {};

    // Apply loading strategy from options or keep default
    if (this._loadingDefaults.strategy) {
      this._defaultLoadingStrategy = this._loadingDefaults.strategy;
      this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
    } else {
      this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
    }

    this.initializeDbSets();
  }

  /**
   * Get a DbSet for the specified entity type
   *
   * @param entityClass Constructor of the entity type.
   * @returns Configured `DbSet` instance.
   */
  public set<T extends object>(entityClass: new () => T): DbSet<T> {
    const getOwn = (Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown })
      .getOwnMetadata;
    const maybe = getOwn?.('orm:original', entityClass);
    const normalized = typeof maybe === 'function' ? maybe : entityClass;
    if (!this._dbSets.has(normalized)) {
      throw new Error(`DbSet for ${entityClass.name} is not configured`);
    }
    const dbSet = this._dbSets.get(normalized) as unknown as DbSet<T>;
    // Ensure the DbSet reflects the exact (possibly decorated) class passed in
    dbSet._entityClass = entityClass;
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
    const prereg = MetadataStorage.getEntities();
    for (const e of prereg) {
      try {
        if (!e.target) continue;
        const original = getOriginal(e.target);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _tmp = new (original as unknown as new () => unknown)();
      } catch {
        // ignore constructors with side-effects/args
      }
    }
    const entities = MetadataStorage.getEntities();

    for (const entity of entities) {
      await this._provider.createTable(entity as any);
    }
  }

  /**
   * Save all changes tracked by the change tracker
   * Similar to Entity Framework's SaveChanges()
   *
   * @returns Number of affected rows.
   */
  public async saveChanges(): Promise<number> {
    const changes = this._changeTracker.getChanges();
    if (!changes || changes.length === 0) return 0;
    this.prefillDefaults(changes);
    const normalizedForValidation = this.normalizeForValidation(changes);
    this._validationService.validate(
      normalizedForValidation as Array<{
        entity: Record<string, unknown>;
        entityClass: Function;
        state: string;
        originalValues?: object;
      }>
    );
    let affectedRows = 0;
    for (const change of changes) {
      const normalized = this.normalizeChange(change);
      this.applyAudit(normalized);
      affectedRows += await this.processChange(normalized);
    }
    // Smart invalidation after successful DML
    const normalizedForInvalidation = normalizedForValidation.map((c) => ({
      entity: c.entity,
      entityClass: c.entityClass,
      state: c.state
    }));
    this.invalidateCachesAfterSave(normalizedForInvalidation);
    this._changeTracker.acceptAllChanges();
    return affectedRows;
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

  /**
   * Start a database transaction
   */
  public async beginTransaction(): Promise<void> {
    await this._provider.beginTransaction();
  }

  /**
   * Commit the current transaction
   */
  public async commitTransaction(): Promise<void> {
    await this._provider.commitTransaction();
    // Invalidate count cache after commit to avoid stale totals across contexts
    // This is a coarse-grained approach since count cache is global
    try {
      (
        require('../query/Queryable') as { Queryable: { clearCountCache: () => void } }
      ).Queryable.clearCountCache();
      // Smart invalidation: clear L2 cache for entities that declare dependencies
      this.invalidateCachesOnCommit();
      if (this._entityCache) {
        const { safeCacheSize } = require('@ts-linq/metrics-safe') as {
          safeCacheSize: (
            logger: unknown,
            payload: { cache: 'entityL2'; size: number; provider?: string }
          ) => void;
        };
        safeCacheSize(this._provider.loggerRef, {
          cache: 'entityL2',
          size: this._entityCache.size?.() ?? -1,
          provider: this._provider.providerLabel
        });
      }
    } catch (e) {
      // logInternalError('DbContext.commitTransaction.invalidateCaches', e);
    }
  }

  /**
   * Rollback the current transaction
   */
  public async rollbackTransaction(): Promise<void> {
    await this._provider.rollbackTransaction();
    // Invalidate L2 cache and count cache on rollback to ensure consistency
    if (this._entityCache) {
      try {
        this._entityCache.clear();
        const { safeCacheSize } = require('@ts-linq/metrics-safe') as {
          safeCacheSize: (
            logger: unknown,
            payload: { cache: 'entityL2'; size: number; provider?: string }
          ) => void;
        };
        safeCacheSize(this._provider.loggerRef, {
          cache: 'entityL2',
          size: this._entityCache.size?.() ?? 0,
          provider: this._provider.providerLabel
        });
      } catch (e) {
        // logInternalError('DbContext.rollbackTransaction.entityCacheClear', e);
      }
    }
    try {
      (
        require('../query/Queryable') as { Queryable: { clearCountCache: () => void } }
      ).Queryable.clearCountCache();
    } catch (e) {
      // logInternalError('DbContext.rollbackTransaction.countCacheClear', e);
    }
  }

  /**
   * Smart invalidation hook executed on successful commit.
   * Current implementation clears entire L2 cache; later can be refined per-entity via metadata.
   */
  private invalidateCachesOnCommit(): void {
    try {
      if (this._entityCache) this._entityCache.clear();
      // Future: inspect changeTracker changes and Reflect.getMetadata('orm:cachePolicy', entity)
      // to perform targeted invalidation per-entity/table.
    } catch (e) {
      // logInternalError('DbContext.invalidateCachesOnCommit', e);
    }
  }

  /**
   * Targeted cache invalidation after saveChanges.
   * - Removes deleted entities from L2 by primary key
   * - Clears L2 entirely if any dependent CachePolicy requires invalidation
   * - Clears global count cache (best-effort)
   */
  private invalidateCachesAfterSave(
    changes: Array<{ entity: Record<string, unknown>; entityClass: Function; state: string }>
  ): void {
    try {
      const changedNames = new Set<string>(changes.map((c) => c.entityClass.name));
      const needFullL2Clear = this.computeNeedFullL2Clear(changedNames);
      this.removeDeletedFromEntityCache(changes, needFullL2Clear);
      this.invalidateSqlCacheByNames(changedNames);
      this.invalidateCountCacheByNames(changedNames);
    } catch (e) {
      // logInternalError('DbContext.invalidateCachesAfterSave', e);
    }
  }

  private computeNeedFullL2Clear(changedNames: ReadonlySet<string>): boolean {
    try {
      const entities = require('../metadata/MetadataStorage').MetadataStorage.getEntities();
      for (const e of entities) {
        const meta = (
          Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown }
        ).getOwnMetadata?.('orm:cachePolicy', e.target as Function) as
          | { invalidateOn?: ReadonlyArray<string> }
          | undefined;
        if (meta?.invalidateOn && meta.invalidateOn.some((n) => changedNames.has(n))) {
          return true;
        }
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  private removeDeletedFromEntityCache(
    changes: ReadonlyArray<{
      entity: Record<string, unknown>;
      entityClass: Function;
      state: string;
    }>,
    needFullClear: boolean
  ): void {
    if (!this._entityCache) return;
    try {
      for (const c of changes) {
        if (c.state === 'deleted') {
          const pk = this.getPrimaryKey(c.entityClass);
          if (pk !== undefined) {
            this._entityCache.remove(c.entityClass, c.entity[pk]);
          }
        }
      }
      if (needFullClear) this._entityCache.clear();
    } catch (e) {
      // logInternalError('DbContext.removeDeletedFromEntityCache', e);
    }
  }

  private invalidateSqlCacheByNames(changedNames: ReadonlySet<string>): void {
    try {
      const qb = require('../query/QueryBuilder') as {
        QueryBuilder: { invalidateForEntity: (name: string) => number };
      };
      for (const name of changedNames) qb.QueryBuilder.invalidateForEntity(name);
    } catch (e) {
      // logInternalError('DbContext.invalidateCachesAfterSave.sqlCache', e);
    }
  }

  private invalidateCountCacheByNames(changedNames: ReadonlySet<string>): void {
    try {
      const extCount: { invalidateBy?: (m: (k: string) => boolean) => number } | undefined =
        this._performanceOptions?.countCache;
      if (!extCount?.invalidateBy) return;
      for (const name of changedNames) {
        extCount.invalidateBy((k) => k.startsWith(name + '|count|'));
      }
    } catch (e) {
      // logInternalError('DbContext.invalidateCachesAfterSave.countCache', e);
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
      try {
        const qb = require('../query/QueryBuilder') as {
          QueryBuilder: { invalidateForEntity: (name: string) => number };
        };
        for (const name of entityNames) qb.QueryBuilder.invalidateForEntity(name);
      } catch (e) {
        // logInternalError('DbContext.cache.invalidateByEntity.sqlCache', e);
      }
      try {
        const extCount: { invalidateBy?: (m: (k: string) => boolean) => number } | undefined =
          this._performanceOptions?.countCache;
        if (extCount?.invalidateBy) {
          for (const name of entityNames) {
            extCount.invalidateBy((k) => k.includes(`|count|`) && k.includes(`${name}|`));
          }
        }
      } catch (e) {
        // logInternalError('DbContext.cache.invalidateByEntity.countCache', e);
      }
    },
    reportMetrics: (): void => {
      try {
        const sqlCache = (
          this as unknown as {
            _sqlBuilder?: { getCacheMetrics?: () => { currentSize?: number } };
          }
        )._sqlBuilder;
        const sqlMetrics = sqlCache?.getCacheMetrics?.();
        const countCache = this._performanceOptions?.countCache;
        const countMetrics = (
          countCache as unknown as { getMetrics?: () => { currentSize?: number } }
        )?.getMetrics?.();
        const logger = this._provider.loggerRef as unknown as {
          cacheSize?: (p: {
            cache: 'sqlGen' | 'count' | 'entityL2';
            size: number;
            provider?: string;
          }) => void;
          cache?: (p: {
            cache: 'sqlGen' | 'count' | 'entityL2';
            hit: boolean;
            provider?: string;
          }) => void;
        };
        if (sqlMetrics)
          logger?.cacheSize?.({
            cache: 'sqlGen',
            size: (sqlMetrics as { currentSize?: number }).currentSize ?? -1,
            provider: this._provider.providerLabel
          });
        if (countMetrics)
          logger?.cacheSize?.({
            cache: 'count',
            size: (countMetrics as { currentSize?: number }).currentSize ?? -1,
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
    // Stop external memory profiler if started
    try {
      this._memoryProfiler?.stop?.();
    } catch (e) {
      // logInternalError('DbContext.dispose.memoryProfiler.stop', e);
    }
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
   * Get the change tracker
   *
   * @returns The `ChangeTracker` handling entity states.
   */
  protected get changeTracker(): ChangeTracker {
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
  private initializeDbSets(): void {
    const entities = MetadataStorage.getEntities();

    for (const entity of entities) {
      if (!entity.target) continue;
      const original = getOriginal(entity.target);
      const dbSet = new DbSet<object>(
        original as unknown as new () => object,
        this._provider,
        this._changeTracker,
        this._entityLoader,
        this._entityCache,
        this._performanceOptions,
        this._globalFilters
      );
      this._dbSets.set(original, dbSet);

      // Create property on context instance for easy access
      const base = original.name.toLowerCase();
      const propertyName = base.endsWith('y') ? base.slice(0, -1) + 'ies' : base + 's';
      Object.defineProperty(this, propertyName, {
        get: () => dbSet,
        enumerable: true,
        configurable: true
      });
    }
  }

  /** Basic model validation: not-null and length. */
  private validateChanges(
    changes: Array<{
      entity: Record<string, unknown>;
      entityClass: Function;
      state: string;
      originalValues?: object;
    }>
  ): void {
    const errors: Array<{
      entity: string;
      property: string;
      message: string;
      entityClass?: string;
      table?: string;
      column?: string;
      fullMessage?: string;
    }> = [];
    for (const change of changes) {
      if (change.state !== 'added' && change.state !== 'modified') continue;
      const meta = MetadataStorage.getEntity(change.entityClass);
      if (!meta) continue;
      const audit = this._audit?.enabled ? this._audit : undefined;
      const auditNames = this.extractAuditNames(audit);
      for (const col of meta.columns) {
        this.validateComputedColumn(meta, col, change, errors);
        this.validateNullAndLength(meta, col, change, audit, auditNames, errors);
      }
      this.runConditionalValidations(change, meta, errors);
    }
    if (errors.length > 0) throw new ValidationError('Model validation failed');
  }

  // ================= Helpers extracted from saveChanges =================

  private prefillDefaults(
    changes: Array<{ entity: object; entityClass: Function; state: string }>
  ): void {
    for (const change of changes) {
      if (change.state !== 'added') continue;
      const meta = MetadataStorage.getEntity(change.entityClass);
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

  private normalizeChange(change: { entity: object; entityClass: Function; state: string }): {
    entity: Record<string, unknown>;
    entityClass: Function;
    state: string;
  } {
    return {
      entity: change.entity as Record<string, unknown>,
      entityClass: change.entityClass,
      state: change.state
    };
  }

  private applyAudit(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
    state: string;
  }): void {
    if (!this._audit?.enabled) return;
    const meta = MetadataStorage.getEntity(change.entityClass);
    if (!meta) return;
    const names = this.extractAuditNames(this._audit);
    if (!names) return;
    const now = (this._audit.clock ?? (() => new Date()))();
    const currentUser = this._audit.getCurrentUserId?.();

    if (change.state === 'added') {
      this.applyCreatedAudit(meta, change.entity, names, now, currentUser);
    }
    if (change.state === 'added' || change.state === 'modified') {
      this.applyUpdatedAudit(meta, change.entity, names, now, currentUser);
    }
  }

  private applyCreatedAudit(
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    entity: Record<string, unknown>,
    names: { createdAt: string; updatedAt: string; createdBy: string; updatedBy: string },
    now: Date,
    currentUser: unknown
  ): void {
    if (this.hasProperty(meta, names.createdAt)) entity[names.createdAt] = now;
    if (this.hasProperty(meta, names.createdBy) && currentUser !== undefined)
      entity[names.createdBy] = currentUser as unknown as string;
  }

  private applyUpdatedAudit(
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    entity: Record<string, unknown>,
    names: { createdAt: string; updatedAt: string; createdBy: string; updatedBy: string },
    now: Date,
    currentUser: unknown
  ): void {
    if (this.hasProperty(meta, names.updatedAt)) entity[names.updatedAt] = now;
    if (this.hasProperty(meta, names.updatedBy) && currentUser !== undefined)
      entity[names.updatedBy] = currentUser as unknown as string;
  }

  private hasProperty(
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    propertyName: string
  ): boolean {
    return meta.columns.some((c: any) => c.propertyName === propertyName);
  }

  private async processChange(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
    state: string;
  }): Promise<number> {
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

  private async applyInsert(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
  }): Promise<void> {
    await this._insertCmd.execute({ ...change, state: 'added' });
  }

  private async applyUpdate(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
  }): Promise<void> {
    await this._updateCmd.execute({ ...change, state: 'modified' });
  }

  private async applyDelete(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
  }): Promise<boolean> {
    return await this._deleteCmd.execute({ ...change, state: 'deleted' });
  }

  private async handleSoftDelete(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
  }): Promise<boolean> {
    if (!this._softDelete?.enabled) return false;
    const meta = MetadataStorage.getEntity(change.entityClass);
    if (!meta) return false;
    const flag = this._softDelete.column ?? 'isDeleted';
    const deletedAt = (this._softDelete as any).deletedAtColumn ?? 'deletedAt';
    const hasFlag = meta.columns.some((c: any) => c.propertyName === flag || c.columnName === flag);
    if (!hasFlag) return false;
    change.entity[flag] = true as unknown as boolean;
    const hasDeletedAt = meta.columns.some(
      (c: any) => c.propertyName === deletedAt || c.columnName === deletedAt
    );
    if (hasDeletedAt) change.entity[deletedAt] = new Date();
    await this._provider.update(change.entity, change.entityClass);
    this.updateEntityCache(change);
    return true;
  }

  private updateEntityCache(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
  }): void {
    if (!this._entityCache) return;
    const pk = this.getPrimaryKey(change.entityClass);
    if (!pk) return;
    this._entityCache.set(change.entityClass, change.entity[pk], change.entity);
  }

  private removeFromEntityCache(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
  }): void {
    if (!this._entityCache) return;
    const pk = this.getPrimaryKey(change.entityClass);
    if (!pk) return;
    this._entityCache.remove(change.entityClass, change.entity[pk]);
  }

  private getPrimaryKey(entityClass: Function): string | undefined {
    const meta = MetadataStorage.getEntity(entityClass);
    return meta?.primaryKeys?.[0];
  }

  /**
   * Retrieve cached validation rules for an entity class (Reflect metadata → cache).
   */
  private getValidationRules(
    entityClass: Function
  ): Array<{ propertyName: string; predicate: (e: unknown) => boolean; message?: string }> {
    const cached = this._validationRulesCache.get(entityClass);
    if (cached) return cached;
    // Stage-3: Use MetadataStorage instead of Reflect API
    const rules = MetadataStorage.getValidationRules(entityClass).slice() as any;
    this._validationRulesCache.set(entityClass, rules);
    return rules;
  }

  private extractAuditNames(
    audit?: AuditOptions
  ): { createdAt: string; updatedAt: string; createdBy: string; updatedBy: string } | undefined {
    if (!audit) return undefined;
    return {
      createdAt: audit.timeColumns?.createdAt ?? 'createdAt',
      updatedAt: audit.timeColumns?.updatedAt ?? 'updatedAt',
      createdBy: audit.userColumns?.createdBy ?? 'createdBy',
      updatedBy: audit.userColumns?.updatedBy ?? 'updatedBy'
    };
  }

  private validateComputedColumn(
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    col: { propertyName: string; isComputed?: boolean },
    change: {
      entity: Record<string, unknown>;
      state: string;
      originalValues?: object;
    },
    errors: Array<{ entity: string; property: string; message: string; fullMessage?: string }>
  ): void {
    if (!col.isComputed) return;
    const value = change.entity[col.propertyName];
    if (change.state === 'added') {
      if (value !== undefined)
        errors.push(
          this.buildValidationDetail(
            meta,
            col.propertyName,
            'Computed column is read-only and cannot be set on insert'
          )
        );
      return;
    }
    if (change.state === 'modified' && change.originalValues) {
      const prev = (change.originalValues as Record<string, unknown>)[col.propertyName];
      if (value !== prev)
        errors.push(
          this.buildValidationDetail(
            meta,
            col.propertyName,
            'Computed column is read-only and cannot be updated'
          )
        );
    }
  }

  private validateNullAndLength(
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    col: {
      propertyName: string;
      isGenerated?: boolean;
      nullable?: boolean;
      length?: number;
      defaultValue?: unknown;
    },
    change: { entity: Record<string, unknown>; state: string },
    audit: AuditOptions | undefined,
    auditNames:
      | { createdAt: string; updatedAt: string; createdBy: string; updatedBy: string }
      | undefined,
    errors: Array<{ entity: string; property: string; message: string; fullMessage?: string }>
  ): void {
    const value = change.entity[col.propertyName];
    const isGeneratedPk = this.isGeneratedPrimaryKey(meta, col, change);
    const hasDbDefault = col.defaultValue !== undefined && change.state === 'added';
    const satisfiableByAudit = this.canBeSatisfiedByAudit(
      audit,
      auditNames,
      change.state,
      col.propertyName
    );
    if (
      !col.nullable &&
      (value === null || value === undefined) &&
      !isGeneratedPk &&
      !hasDbDefault &&
      !satisfiableByAudit
    ) {
      errors.push(this.buildValidationDetail(meta, col.propertyName, 'Value cannot be null'));
    }
    if (col.length && typeof value === 'string' && value.length > col.length) {
      errors.push(
        this.buildValidationDetail(meta, col.propertyName, `Length exceeds ${col.length}`)
      );
    }
  }

  private isGeneratedPrimaryKey(
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    col: { propertyName: string; isGenerated?: boolean },
    change: { state: string }
  ): boolean {
    return (
      !!meta &&
      !!meta.primaryKeys &&
      meta.primaryKeys.includes(col.propertyName) &&
      !!col.isGenerated &&
      change.state === 'added'
    );
  }

  private canBeSatisfiedByAudit(
    audit: AuditOptions | undefined,
    auditNames:
      | { createdAt: string; updatedAt: string; createdBy: string; updatedBy: string }
      | undefined,
    state: string,
    propertyName: string
  ): boolean {
    if (!audit || !auditNames) return false;
    if (
      state === 'added' &&
      (propertyName === auditNames.createdAt || propertyName === auditNames.createdBy)
    ) {
      return propertyName === auditNames.createdAt || audit.getCurrentUserId !== undefined;
    }
    if (
      (state === 'added' || state === 'modified') &&
      (propertyName === auditNames.updatedAt || propertyName === auditNames.updatedBy)
    ) {
      return propertyName === auditNames.updatedAt || audit.getCurrentUserId !== undefined;
    }
    return false;
  }

  private runConditionalValidations(
    change: { entity: Record<string, unknown>; entityClass: Function; state: string },
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    errors: Array<{ entity: string; property: string; message: string; fullMessage?: string }>
  ): void {
    try {
      const rules = this.getValidationRules(change.entityClass);
      for (const rule of rules) {
        const phase = (rule as { phase?: 'onCreate' | 'onUpdate' | 'always' }).phase || 'always';
        if (phase === 'onCreate' && change.state !== 'added') continue;
        if (phase === 'onUpdate' && change.state !== 'modified') continue;
        const ok = !!rule.predicate(change.entity);
        if (!ok) {
          const msgKey = (rule as { messageKey?: string }).messageKey;
          const msgParams = (rule as { messageParams?: Record<string, unknown> }).messageParams;
          const translated =
            msgKey && this._validationOptions?.translate
              ? this._validationOptions.translate(msgKey, msgParams)
              : undefined;
          const baseMsg = translated || rule.message || 'Validation rule failed';
          errors.push(this.buildValidationDetail(meta, rule.propertyName, baseMsg));
        }
      }
    } catch {
      /* ignore */
    }
  }

  private buildValidationDetail(
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    property: string,
    message: string
  ): {
    entity: string;
    property: string;
    message: string;
    entityClass?: string;
    table?: string;
    column?: string;
    fullMessage?: string;
  } {
    const table = meta?.tableName || 'unknown_table';
    const typeName = meta?.target?.name || 'UnknownEntity';
    const col = meta?.columns.find((c: any) => c.propertyName === property)?.columnName || property;
    const fullMessage = `${typeName}.${property} (${table}.${col}): ${message}`;
    return {
      entity: table,
      property,
      message,
      entityClass: typeName,
      table,
      column: col,
      fullMessage
    };
  }
}
