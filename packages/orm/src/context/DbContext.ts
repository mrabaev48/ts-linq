import type { DatabaseProvider, ValidationError } from '@ts-linq/core';
import { ChangeTracker } from '../change-tracking/ChangeTracker';
import { EntityLoader } from '../loading/EntityLoader';
import type { LoadingOptions } from '../loading/LoadingStrategy';
import { LoadingStrategy } from '../loading/LoadingStrategy';
import { MetadataStorage } from '@ts-linq/core';
import { LazyLoadingProxy } from '../loading/LazyLoadingProxy';
import type {
  DbContextOptions,
  PerformanceOptions,
  Result,
  LoadingDefaults,
  SoftDeleteOptions,
  AuditOptions,
  GlobalFilter,
  EntityCacheLike
} from '@ts-linq/core';
import { ok, err, EntityCache } from '@ts-linq/core';
import { DbSet } from './DbSet';
import { InsertCommand } from '../../../core/src/context/commands/InsertCommand';
import { UpdateCommand } from '../../../core/src/context/commands/UpdateCommand';
import { DeleteCommand } from '../../../core/src/context/commands/DeleteCommand';
import { ChangeValidationService } from '../../../core/src/context/services/ChangeValidationService';
import { safeCacheSize } from 'metrics-safe';

function getOriginal<T extends Function>(target: T): T {
  try {
    const gm = (Reflect as unknown as { getOwnMetadata?: (k: string, t: Function) => unknown })
      .getOwnMetadata;
    const original = (gm && (gm('design:type', target) as T)) || target;
    return original;
  } catch {
    return target;
  }
}

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
  private _validationService!: ChangeValidationService;
  private _insertCmd!: InsertCommand;
  private _updateCmd!: UpdateCommand;
  private _deleteCmd!: DeleteCommand;
  private _validationRulesCache: WeakMap<
    Function,
    Array<{ propertyName: string; predicate: (e: unknown) => boolean; message?: string }>
  > = new WeakMap();

  constructor(options: DbContextOptions) {
    this._provider = options.provider;
    this._softDelete = options.softDelete;
    try {
      (this._provider as unknown as { softDelete?: SoftDeleteOptions }).softDelete =
        options.softDelete;
    } catch {}
    this._audit = options.audit;
    this._globalFilters = options.globalFilters;
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
      (c) => this.handleSoftDelete(c),
      (c) => this.removeFromEntityCache(c)
    );
    if (options.performance?.enableEntityCache) {
      this._entityCache = new EntityCache(
        options.performance.entityCacheSize ?? 10000,
        this._provider.loggerRef,
        this._provider.providerLabel
      );
    }
    this._performanceOptions = options.performance;
    this._loadingDefaults = options.loading || {};
    if (this._loadingDefaults.strategy) {
      this._defaultLoadingStrategy = this._loadingDefaults.strategy;
      this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
    } else {
      this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
    }
    this.initializeDbSets();
  }

  public set<T extends object>(entityClass: new () => T): DbSet<T> {
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) throw new Error(`Entity ${entityClass.name} is not registered in metadata storage`);
    return (this._dbSets.get(entityClass) as DbSet<T>) || this.registerDbSet(entityClass);
  }

  protected configure(options: {
    loading?: LoadingDefaults;
    performance?: PerformanceOptions;
    softDelete?: SoftDeleteOptions;
    audit?: AuditOptions;
    logger?: { warn(message: string, error?: unknown): void };
  }): void {
    this._loadingDefaults = options.loading || this._loadingDefaults;
    if (this._loadingDefaults.strategy) {
      this._defaultLoadingStrategy = this._loadingDefaults.strategy;
      this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
    }
    this._performanceOptions = options.performance || this._performanceOptions;
    this._softDelete = options.softDelete ?? this._softDelete;
    this._audit = options.audit ?? this._audit;
    LazyLoadingProxy.setLogger(options.logger);
  }

  public get provider(): DatabaseProvider {
    return this._provider;
  }

  public get changeTracker(): ChangeTracker {
    return this._changeTracker;
  }

  // Minimal lifecycle/transaction helpers used by tests
  public async ensureCreated(): Promise<void> {
    const entities = MetadataStorage.getEntities();
    await this._provider.connect?.();
    for (const meta of entities) {
      await this._provider.createTable?.(meta);
    }
  }

  public async dispose(): Promise<void> {
    await this._provider.disconnect?.();
  }

  public async beginTransaction(): Promise<void> {
    await this._provider.beginTransaction?.();
  }

  public async commitTransaction(): Promise<void> {
    await this._provider.commitTransaction?.();
    // Clear Queryable count cache and emit size metric
    try {
      // Try both src and non-src alias paths to support jest mappers
      const qmod =
        (require('@ts-linq/core/src/query/Queryable') as {
          Queryable?: { clearCountCache: () => void };
        }) ||
        (require('@ts-linq/core/query/Queryable') as {
          Queryable?: { clearCountCache: () => void };
        });
      qmod?.Queryable?.clearCountCache?.();
    } catch {}
    try {
      safeCacheSize(this._provider.loggerRef, {
        cache: 'count',
        size: -1,
        provider: this._provider.providerLabel
      });
    } catch {}
  }

  public async rollbackTransaction(): Promise<void> {
    await this._provider.rollbackTransaction?.();
    try {
      const qmod =
        (require('@ts-linq/core/src/query/Queryable') as {
          Queryable?: { clearCountCache: () => void };
        }) ||
        (require('@ts-linq/core/query/Queryable') as {
          Queryable?: { clearCountCache: () => void };
        });
      qmod?.Queryable?.clearCountCache?.();
    } catch {}
    try {
      safeCacheSize(this._provider.loggerRef, {
        cache: 'count',
        size: -1,
        provider: this._provider.providerLabel
      });
    } catch {}
  }

  public async trySaveChanges(): Promise<Result<number>> {
    try {
      this._changeTracker.detectChanges();
      const changes = this._changeTracker.getChanges();
      this._validationService.validate(
        changes.map((c) => ({
          entity: c.entity as Record<string, unknown>,
          entityClass: c.entityClass,
          state: c.state,
          originalValues: c.originalValues
        }))
      );
      let affected = 0;
      for (const change of changes) {
        // Apply audit fields if configured
        if (this._audit?.enabled) {
          const names = {
            createdAt: this._audit.timeColumns?.createdAt ?? 'createdAt',
            updatedAt: this._audit.timeColumns?.updatedAt ?? 'updatedAt'
          };
          if (change.state === 'added') {
            if ((change.entity as Record<string, unknown>)[names.createdAt] === undefined)
              (change.entity as Record<string, unknown>)[names.createdAt] = new Date();
            if ((change.entity as Record<string, unknown>)[names.updatedAt] === undefined)
              (change.entity as Record<string, unknown>)[names.updatedAt] = new Date();
          } else if (change.state === 'modified') {
            (change.entity as Record<string, unknown>)[names.updatedAt] = new Date();
          }
        }
        if (change.state === 'added') {
          await this._insertCmd.execute(change as never);
          affected++;
        } else if (change.state === 'modified') {
          await this._updateCmd.execute(change as never);
          affected++;
        } else if (change.state === 'deleted') {
          await this._deleteCmd.execute(change as never);
          affected++;
        }
      }
      this._changeTracker.acceptAllChanges();
      return ok(affected);
    } catch (e) {
      return err(e as Error | ValidationError);
    }
  }

  public async saveChanges(): Promise<number> {
    const res = await this.trySaveChanges();
    if ((res as unknown as { ok?: boolean }).ok === false)
      throw (res as unknown as { error: Error }).error;
    return (res as unknown as { value: number }).value;
  }

  private async handleSoftDelete(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
  }): Promise<boolean> {
    if (!this._softDelete?.enabled) return false;
    const meta = MetadataStorage.getEntity(change.entityClass);
    if (!meta) return false;
    const flag = this._softDelete.column ?? 'isDeleted';
    const deletedAt = this._softDelete.deletedAtColumn ?? 'deletedAt';
    const hasFlag = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
    if (!hasFlag) return false;
    change.entity[flag] = true as unknown as boolean;
    const hasDeletedAt = meta.columns.some(
      (c) => c.propertyName === deletedAt || c.columnName === deletedAt
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
    return meta?.primaryKeys[0];
  }

  private initializeDbSets(): void {
    const entities = MetadataStorage.getEntities();
    for (const meta of entities) {
      this.registerDbSet(meta.target as new () => object);
    }
  }

  private registerDbSet<T extends object>(entityClass: new () => T): DbSet<T> {
    const set = new DbSet<T>(
      entityClass,
      this._provider,
      this._changeTracker,
      this._entityLoader,
      this._entityCache,
      this._performanceOptions,
      this._globalFilters
    );
    const propName = this.buildAutoPropertyName(entityClass.name);
    Object.defineProperty(this, propName, {
      get: () => set,
      enumerable: true,
      configurable: true
    });
    this._dbSets.set(entityClass, set as unknown as DbSet<object>);
    return set;
  }

  private buildAutoPropertyName(typeName: string): string {
    const n = typeName.charAt(0).toLowerCase() + typeName.slice(1);
    if (n.endsWith('y')) return `${n.slice(0, -1)}ies`;
    return `${n}s`;
  }

  public async include<T extends object>(
    entity: T,
    entityClass: new () => T,
    ...relationships: string[]
  ): Promise<void> {
    if (!relationships.length) return;
    if (
      (LazyLoadingProxy as unknown as { isLazyProxy: (o: unknown) => boolean }).isLazyProxy(entity)
    ) {
      await (
        LazyLoadingProxy as unknown as {
          preloadRelationships: (
            entities: T[],
            entityClass: new () => T,
            includes: string[],
            provider: DatabaseProvider
          ) => Promise<void>;
        }
      ).preloadRelationships([entity], entityClass, relationships, this._provider);
      return;
    }
    await this._entityLoader.populateRelationships([entity], entityClass, relationships);
  }

  public isLoaded(entity: unknown, relationship: string): boolean {
    if (
      (LazyLoadingProxy as unknown as { isLazyProxy: (o: unknown) => boolean }).isLazyProxy(entity)
    ) {
      return (
        LazyLoadingProxy as unknown as { isRelationshipLoaded: (o: unknown, p: string) => boolean }
      ).isRelationshipLoaded(entity, relationship);
    }
    return Object.prototype.hasOwnProperty.call(entity as object, relationship);
  }

  public setLoadingStrategy(strategy: LoadingStrategy): void {
    this._defaultLoadingStrategy = strategy;
    this._entityLoader.setDefaultStrategy(strategy);
  }
}
