import type { DatabaseProvider } from '../DatabaseProvider';
import type { ChangeTracker } from '../change-tracking/ChangeTracker';
import type { EntityLoader } from '../loading/EntityLoader';
import type { LoadingOptions } from '../loading/LoadingStrategy';
import { Queryable } from '../query/Queryable';
import type { EntityCacheLike } from '../utils/EntityCache';
import type { PerformanceOptions, GlobalFilter } from '../types';
import { LoadingStrategy } from '../loading/LoadingStrategy';
import { MetadataStorage } from '../metadata/MetadataStorage';

/**
 * Represents a typed set of entities and provides CRUD and LINQ-like operations
 * for a specific entity type.
 */
export class DbSet<T extends object> {
  public _entityClass: new () => T;
  private _provider: DatabaseProvider;
  private _changeTracker: ChangeTracker;
  private _entityLoader: EntityLoader | undefined;
  private _entityCache: EntityCacheLike | undefined;
  private _performance: PerformanceOptions | undefined;
  private _globalFilters: GlobalFilter[] | undefined;

  constructor(
    entityClass: new () => T,
    provider: DatabaseProvider,
    changeTracker: ChangeTracker,
    entityLoader?: EntityLoader,
    entityCache?: EntityCacheLike,
    performance?: PerformanceOptions,
    globalFilters?: GlobalFilter[]
  ) {
    this._entityClass = entityClass;
    this._provider = provider;
    this._changeTracker = changeTracker;
    this._entityLoader = entityLoader;
    this._entityCache = entityCache;
    this._performance = performance;
    this._globalFilters = globalFilters;
  }

  /** Add an entity to be inserted */
  public add(entity: T): T {
    this._changeTracker.add(entity, this._entityClass);
    return entity;
  }

  /** Update an entity */
  public update(entity: T): T {
    this._changeTracker.update(entity, this._entityClass);
    return entity;
  }

  /** Remove an entity */
  public remove(entity: T): T {
    this._changeTracker.remove(entity, this._entityClass);
    return entity;
  }

  /** Add multiple entities at once to ChangeTracker. */
  public addRange(entities: T[]): T[] {
    for (const entity of entities) this._changeTracker.add(entity, this._entityClass);
    return entities;
  }
  /** Update multiple entities at once to ChangeTracker. */
  public updateRange(entities: T[]): T[] {
    for (const entity of entities) this._changeTracker.update(entity, this._entityClass);
    return entities;
  }
  /** Remove multiple entities at once to ChangeTracker. */
  public removeRange(entities: T[]): T[] {
    for (const entity of entities) this._changeTracker.remove(entity, this._entityClass);
    return entities;
  }

  /** Find an entity by its primary key */
  public async find(id: unknown, options?: LoadingOptions): Promise<T | null> {
    if (this._entityLoader && options) {
      return await this._entityLoader.loadEntity(this._entityClass, id, options);
    }
    // Route via Queryable to leverage L2 cache and global filters
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || metadata.primaryKeys.length === 0) {
      return await this._provider.findById(id, this._entityClass);
    }
    const pk = metadata.primaryKeys[0] as keyof T & string;
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    )
      .where((e) => (e as unknown as Record<string, unknown>)[pk] === id)
      .firstOrDefault();
  }

  /** Get all entities */
  public async toArray(options?: LoadingOptions): Promise<T[]> {
    if (this._entityLoader && options) {
      return await this._entityLoader.loadEntities(this._entityClass, options);
    }
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).toArray();
  }

  /** Create a fluent `Queryable` for LINQ-like operations. */
  public where(predicate: (entity: T) => boolean): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).where(predicate);
  }

  /** Proxy: WHERE EXISTS (subquery). */
  public whereExists<TOther>(subquery: Queryable<TOther>): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).whereExists(subquery);
  }
  /** Proxy: column IN (subquery). */
  public whereInSubquery<TOther>(
    column: keyof T & string,
    subquery: Queryable<TOther>
  ): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).whereInSubquery(column, subquery);
  }

  /** Select specific properties */
  public select<TResult>(selector: (entity: T) => TResult): Queryable<TResult> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).select(selector);
  }

  /** Order by a property */
  public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).orderBy(keySelector);
  }

  /** Order by descending */
  public orderByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).orderByDescending(keySelector);
  }

  /** Take a specific number of entities */
  public take(count: number): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).take(count);
  }

  /** Skip a specific number of entities */
  public skip(count: number): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).skip(count);
  }

  /** Get distinct entities */
  public distinct(): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).distinct();
  }

  /** Proxy: UNION of two queries of the same DbSet. */
  public union(other: Queryable<T>): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).union(other);
  }
  /** Proxy: UNION ALL of two queries of the same DbSet. */
  public unionAll(other: Queryable<T>): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).unionAll(other);
  }

  /** Get the first entity or throw if none exists */
  public async first(): Promise<T> {
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).first();
  }

  /** Get the first entity or null if none exists */
  public async firstOrDefault(): Promise<T | null> {
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).firstOrDefault();
  }

  /** Get a single entity or throw if none or multiple exist */
  public async single(): Promise<T> {
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).single();
  }

  /** Get a single entity or null if none exists, throw if multiple exist */
  public async singleOrDefault(): Promise<T | null> {
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).singleOrDefault();
  }

  /** Count entities */
  public async count(): Promise<number> {
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).count();
  }

  /** Check if any entities exist */
  public async any(): Promise<boolean> {
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).any();
  }

  /** Start a query with eager includes using a property selector. */
  public include(selector: (entity: T) => unknown): Queryable<T> {
    const qb = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    );
    return qb.include(selector);
  }

  /** Provider-level bulk insert within a transaction. */
  public async insertMany(entities: T[]): Promise<T[]> {
    return await this._provider.insertMany<T>(entities, this._entityClass);
  }
  /** Provider-level bulk update within a transaction. */
  public async updateMany(entities: T[]): Promise<T[]> {
    return await this._provider.updateMany<T>(entities, this._entityClass);
  }

  /** Upsert single entity by primary key existence check (ChangeTracker-based). */
  public async upsert(entity: T): Promise<T> {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || metadata.primaryKeys.length === 0)
      throw new Error(`No primary key defined for ${this._entityClass.name}`);
    const pk = metadata.primaryKeys[0];
    const id = (entity as unknown as Record<string, unknown>)[pk];
    if (id === undefined || id === null) {
      // No PK value — treat as insert
      this.add(entity);
      return entity;
    }
    const existing = await this._provider.findById(id, this._entityClass as unknown as new () => T);
    if (existing) {
      this.update(entity);
    } else {
      this.add(entity);
    }
    return entity;
  }

  /** Upsert many entities via per-entity PK existence check. */
  public async upsertMany(entities: T[]): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || metadata.primaryKeys.length === 0)
      throw new Error(`No primary key defined for ${this._entityClass.name}`);
    const pk = metadata.primaryKeys[0];
    // Build list of ids present
    const pairs: Array<{ entity: T; id: unknown }> = entities.map((e) => ({
      entity: e,
      id: (e as unknown as Record<string, unknown>)[pk]
    }));
    const ids = pairs.filter((p) => p.id !== undefined && p.id !== null).map((p) => p.id);
    if (ids.length > 0) {
      // Fetch existing ids in one go if provider supports findWhereIn for PK column
      const pkCol = metadata.columns.find((c) => c.propertyName === pk);
      const existingRows = await this._provider.findWhereIn(
        this._entityClass as unknown as new () => T,
        pkCol ? pkCol.propertyName : pk,
        ids
      );
      const existingIdSet = new Set(
        existingRows.map((r) => (r as unknown as Record<string, unknown>)[pk])
      );
      for (const { entity, id } of pairs) {
        if (id === undefined || id === null) {
          this.add(entity);
          continue;
        }
        if (existingIdSet.has(id)) this.update(entity);
        else this.add(entity);
      }
    } else {
      // All new
      this.addRange(entities);
    }
    return entities;
  }
}
