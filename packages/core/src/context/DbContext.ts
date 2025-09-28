import type { DatabaseProvider } from '../DatabaseProvider';
import { ChangeTracker } from '../change-tracking/ChangeTracker';
import { EntityLoader } from '../loading/EntityLoader';
import type { LoadingOptions } from '../loading/LoadingStrategy';
import { LoadingStrategy } from '../loading/LoadingStrategy';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { LazyLoadingProxy } from '../loading/LazyLoadingProxy';
import { DbSet } from './DbSet';
import type {
  DbContextOptions,
  PerformanceOptions,
  Result,
  LoadingDefaults,
  SoftDeleteOptions,
  AuditOptions,
  GlobalFilter
} from '../types';
import { ok, err, ValidationError } from '../types';
import type { EntityCacheLike } from '../utils/EntityCache';
import { EntityCache } from '../utils/EntityCache';

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
  private _validationOptions?: {
    translate?: (key: string, params?: Record<string, unknown>) => string;
  };
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
    this._audit = options.audit;
    this._globalFilters = options.globalFilters;
    this._validationOptions = options.validation;

    this._changeTracker = new ChangeTracker();
    this._entityLoader = new EntityLoader(this._provider);
    // Initialize optional L2 entity cache
    if (options.performance?.enableEntityCache) {
      this._entityCache = new EntityCache(
        options.performance.entityCacheSize ?? 10000,
        this._provider.loggerRef,
        this._provider.providerLabel
      );
    }
    // Store performance options for downstream consumers
    this._performanceOptions = options.performance;
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
        const original = getOriginal(e.target);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _tmp = new (original as unknown as new () => unknown)();
      } catch {
        // ignore constructors with side-effects/args
      }
    }
    const entities = MetadataStorage.getEntities();

    for (const entity of entities) {
      await this._provider.createTable(entity);
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
    // Prefill DB defaults on Added entities to satisfy validation and keep entity consistent
    for (const change of changes) {
      if (change.state === 'added') {
        const meta = MetadataStorage.getEntity(change.entityClass);
        if (meta) {
          for (const col of meta.columns) {
            if (
              (change.entity as Record<string, unknown>)[col.propertyName] === undefined &&
              col.defaultValue !== undefined
            ) {
              (change.entity as Record<string, unknown>)[col.propertyName] = col.defaultValue;
            }
          }
        }
      }
    }
    // Validate entities before persistence
    this.validateChanges(
      changes as Array<{ entity: Record<string, unknown>; entityClass: Function; state: string }>
    );
    let affectedRows = 0;

    for (const change of changes) {
      // Apply audit stamping before persistence
      if (this._audit?.enabled) {
        const meta = MetadataStorage.getEntity(change.entityClass);
        if (meta) {
          const now = (this._audit.clock ?? (() => new Date()))();
          const createdAt = this._audit.timeColumns?.createdAt ?? 'createdAt';
          const updatedAt = this._audit.timeColumns?.updatedAt ?? 'updatedAt';
          const createdBy = this._audit.userColumns?.createdBy ?? 'createdBy';
          const updatedBy = this._audit.userColumns?.updatedBy ?? 'updatedBy';
          const currentUser = this._audit.getCurrentUserId?.();
          if (change.state === 'added') {
            if (meta.columns.some((c) => c.propertyName === createdAt))
              (change.entity as Record<string, unknown>)[createdAt] = now;
            if (meta.columns.some((c) => c.propertyName === createdBy) && currentUser !== undefined)
              (change.entity as Record<string, unknown>)[createdBy] =
                currentUser as unknown as string;
          }
          if (change.state === 'added' || change.state === 'modified') {
            if (meta.columns.some((c) => c.propertyName === updatedAt))
              (change.entity as Record<string, unknown>)[updatedAt] = now;
            if (meta.columns.some((c) => c.propertyName === updatedBy) && currentUser !== undefined)
              (change.entity as Record<string, unknown>)[updatedBy] =
                currentUser as unknown as string;
          }
        }
      }
      switch (change.state) {
        case 'added':
          await this._provider.insert(change.entity, change.entityClass);
          // update L2 cache
          if (this._entityCache) {
            const meta = MetadataStorage.getEntity(change.entityClass);
            const pk = meta?.primaryKeys[0];
            if (pk)
              this._entityCache.set(
                change.entityClass,
                (change.entity as Record<string, unknown>)[pk],
                change.entity
              );
          }
          affectedRows++;
          break;
        case 'modified':
          await this._provider.update(change.entity, change.entityClass);
          if (this._entityCache) {
            const meta = MetadataStorage.getEntity(change.entityClass);
            const pk = meta?.primaryKeys[0];
            if (pk)
              this._entityCache.set(
                change.entityClass,
                (change.entity as Record<string, unknown>)[pk],
                change.entity
              );
          }
          affectedRows++;
          break;
        case 'deleted':
          // Soft delete if enabled and entity has configured column, else hard delete
          if (this._softDelete?.enabled) {
            const meta = MetadataStorage.getEntity(change.entityClass);
            const flag = this._softDelete.column ?? 'isDeleted';
            const deletedAt = this._softDelete.deletedAtColumn ?? 'deletedAt';
            if (
              meta &&
              meta.columns.some((c) => c.propertyName === flag || c.columnName === flag)
            ) {
              (change.entity as Record<string, unknown>)[flag] = true as unknown as boolean;
              if (
                meta.columns.some((c) => c.propertyName === deletedAt || c.columnName === deletedAt)
              ) {
                (change.entity as Record<string, unknown>)[deletedAt] = new Date();
              }
              await this._provider.update(change.entity, change.entityClass);
              if (this._entityCache) {
                const pk = meta.primaryKeys[0];
                this._entityCache.set(
                  change.entityClass,
                  (change.entity as Record<string, unknown>)[pk],
                  change.entity
                );
              }
              affectedRows++;
              break;
            }
          }
          await this._provider.delete(change.entity, change.entityClass);
          if (this._entityCache) {
            const meta = MetadataStorage.getEntity(change.entityClass);
            const pk = meta?.primaryKeys[0];
            if (pk)
              this._entityCache.remove(
                change.entityClass,
                (change.entity as Record<string, unknown>)[pk]
              );
          }
          affectedRows++;
          break;
      }
    }

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
      if (this._entityCache) {
        const { safeCacheSize } = require('metrics-safe') as {
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
    } catch {
      /* ignore */
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
        const { safeCacheSize } = require('metrics-safe') as {
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
      } catch {
        /* ignore */
      }
    }
    try {
      (
        require('../query/Queryable') as { Queryable: { clearCountCache: () => void } }
      ).Queryable.clearCountCache();
    } catch {
      /* ignore */
    }
  }

  /**
   * Dispose of the database connection
   */
  public async dispose(): Promise<void> {
    await this._provider.disconnect();
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
    // For non-proxy entities, check if property exists and is not undefined/null
    return (entity as any)[propertyName] !== undefined && (entity as any)[propertyName] !== null;
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
        configurable: false
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
      const auditNames = audit
        ? {
            createdAt: audit.timeColumns?.createdAt ?? 'createdAt',
            updatedAt: audit.timeColumns?.updatedAt ?? 'updatedAt',
            createdBy: audit.userColumns?.createdBy ?? 'createdBy',
            updatedBy: audit.userColumns?.updatedBy ?? 'updatedBy'
          }
        : undefined;
      for (const col of meta.columns) {
        const value = change.entity[col.propertyName];
        // Computed columns are read-only: disallow assignment on insert and modification of value
        if (col.isComputed) {
          if (change.state === 'added') {
            if (value !== undefined) {
              errors.push(
                this.buildValidationDetail(
                  meta,
                  col.propertyName,
                  'Computed column is read-only and cannot be set on insert'
                )
              );
            }
          } else if (change.state === 'modified' && change.originalValues) {
            const prev = (change.originalValues as Record<string, unknown>)[col.propertyName];
            if (value !== prev) {
              errors.push(
                this.buildValidationDetail(
                  meta,
                  col.propertyName,
                  'Computed column is read-only and cannot be updated'
                )
              );
            }
          }
        }
        // Skip validation for auto-generated primary keys on Added entities
        const isGeneratedPk =
          meta.primaryKeys.includes(col.propertyName) &&
          col.isGenerated &&
          change.state === 'added';
        // Allow DB-level defaultValue to satisfy non-null on Added when undefined in entity
        const hasDbDefault = col.defaultValue !== undefined && change.state === 'added';
        // Allow audit stamping to satisfy non-null constraints (compat with audit)
        const satisfiableByAudit =
          !!audit &&
          ((change.state === 'added' &&
            (col.propertyName === auditNames!.createdAt ||
              col.propertyName === auditNames!.createdBy) &&
            (col.propertyName === auditNames!.createdAt || audit.getCurrentUserId !== undefined)) ||
            ((change.state === 'added' || change.state === 'modified') &&
              (col.propertyName === auditNames!.updatedAt ||
                col.propertyName === auditNames!.updatedBy) &&
              (col.propertyName === auditNames!.updatedAt ||
                audit.getCurrentUserId !== undefined)));
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
      // Conditional Validations (Stage-3 ValidIf) — run AFTER base checks
      try {
        const rules = this.getValidationRules(change.entityClass);
        for (const rule of rules) {
          // Phase gating (onCreate / onUpdate / always)
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
    if (errors.length > 0) throw new ValidationError('Model validation failed', errors);
  }

  /**
   * Retrieve cached validation rules for an entity class (Reflect metadata → cache).
   */
  private getValidationRules(
    entityClass: Function
  ): Array<{ propertyName: string; predicate: (e: unknown) => boolean; message?: string }> {
    const cached = this._validationRulesCache.get(entityClass);
    if (cached) return cached;
    const rules = (
      (Reflect.getOwnMetadata('orm:validations', entityClass) as
        | Array<{ propertyName: string; predicate: (e: unknown) => boolean; message?: string }>
        | undefined) || []
    ).slice();
    this._validationRulesCache.set(entityClass, rules);
    return rules;
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
    const col = meta?.columns.find((c) => c.propertyName === property)?.columnName || property;
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
