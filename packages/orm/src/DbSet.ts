import type { DatabaseProvider } from '@ts-linq/core';
import { ChangeTracker } from './ChangeTracker';
import { EntityLoader } from '@ts-linq/core';
import type { LoadingOptions } from '@ts-linq/core';
import { LoadingStrategy } from '@ts-linq/core';
import { ctorName } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { Queryable, TypedQueryable } from '@ts-linq/query';
import type { EntityCacheLike } from '@ts-linq/types';
import type { GlobalFilter, PerformanceOptions, QueryFallback } from '@ts-linq/types';
import type { PrimaryKeyOf } from '@ts-linq/core';
import type { DbSetContext } from './DbSetContext';

/**
 * Represents a typed set of entities and provides CRUD and LINQ-like operations
 * for a specific entity type.
 */
export class DbSet<T extends object> {
  private readonly _entityClass: new () => T;
  private _provider: DatabaseProvider;
  private _changeTracker: ChangeTracker;
  private _entityLoader: EntityLoader | undefined;
  private _entityCache: EntityCacheLike | undefined;
  private _performance: PerformanceOptions | undefined;
  private _globalFilters: GlobalFilter[] | undefined;
  private _softDeleteOptions?: import('@ts-linq/types').SoftDeleteOptions;
  // Default chunk size; can be overridden via PerformanceOptions.inClauseChunkSize
  private static readonly DEFAULT_IN_CHUNK_SIZE = 1000;

  constructor(
    entityClass: new () => T,
    context: DbSetContext
  ) {
    this._entityClass = entityClass;
    this._provider = context.provider;
    this._changeTracker = context.changeTracker;
    this._entityLoader = context.entityLoader;
    this._entityCache = context.entityCache;
    this._performance = context.performance;
    this._globalFilters = context.globalFilters;
    this._softDeleteOptions = context.softDeleteOptions;
  }

  /** The entity constructor this set operates on. */
  get entityClass(): new () => T {
    return this._entityClass;
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

  /** Find an entity by its primary key (convention: property named `id`) */
  public async find(id: PrimaryKeyOf<T>, options?: LoadingOptions): Promise<T | null> {
    if (this._entityLoader && options) {
      return await this._entityLoader.loadEntity(this._entityClass, id, options);
    }
    // Route via Queryable to leverage L2 cache and global filters
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || !metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      return await this._provider.findById(id, this._entityClass);
    }
    const pk = metadata.primaryKeys[0] as keyof T & string;
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    )
      .whereIn(pk, [id as T[typeof pk]])
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
      this._globalFilters,
      this._softDeleteOptions
    ).toArray();
  }

  /** Fetch multiple entities by their primary keys in one query when supported. */
  public async findByIds(ids: ReadonlyArray<PrimaryKeyOf<T>>): Promise<T[]> {
    if (!ids || ids.length === 0) return [];
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || !metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      // Fallback: issue sequential finds
      const results: T[] = [];
      for (const id of ids) {
        const found = await this.find(id);
        if (found) results.push(found);
      }
      return results;
    }
    const pk = metadata.primaryKeys[0];
    const column = metadata.columns.find((c) => c.propertyName === pk)?.columnName || pk;
    
    // Cross-query optimization: deduplicate and chunk large IN lists
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return [];
    const chunkSize = this._performance?.inClauseChunkSize ?? DbSet.DEFAULT_IN_CHUNK_SIZE;
    
    const runChunk = async (chunk: ReadonlyArray<PrimaryKeyOf<T>>) => {
      const typed = chunk as unknown as unknown[];
      return await this._provider.findWhereIn<T>(this._entityClass, column, typed);
    };

    if (uniqueIds.length <= chunkSize) {
      return await runChunk(uniqueIds);
    }
    const aggregated: T[] = [];
    const total = uniqueIds.length;
    let chunks = 0;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const part = await runChunk(chunk);
      aggregated.push(...part);
      chunks++;
    }
    try {
      this._provider.loggerRef?.crossQuery?.({
        op: 'IN-chunk',
        chunks,
        size: total,
        entity: ctorName(this._entityClass),
        column,
        provider: this._provider.providerLabel
      });
    } catch {
      /* ignore */
    }
    return aggregated;
  }

  /**
   * Type-safe IN query by entity property. Maps property to column via metadata.
   * Example: users.findWhereIn('id', [userId]) or users.findWhereIn('name', ['Alice'])
   */
  public async findWhereIn<K extends keyof T & string>(
    property: K,
    values: ReadonlyArray<T[K]>
  ): Promise<T[]> {
    if (!values || values.length === 0) return [];
    // Cross-query optimization: deduplicate inputs and split into chunks
    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length === 0) return [];
    
    const chunkSize = this._performance?.inClauseChunkSize ?? DbSet.DEFAULT_IN_CHUNK_SIZE;
    
    const runChunk = async (chunk: ReadonlyArray<T[K]>) => {
      return await new Queryable<T>(
        this._entityClass,
        this._provider,
        this._entityLoader,
        this._entityCache,
        this._performance,
        this._globalFilters,
        this._softDeleteOptions
      )
      .whereIn(property, chunk)
      .toArray();
    };

    if (uniqueValues.length <= chunkSize) {
      return await runChunk(uniqueValues);
    }
    const aggregated: T[] = [];
    const total = uniqueValues.length;
    let chunks = 0;
    for (let i = 0; i < uniqueValues.length; i += chunkSize) {
      const chunk = uniqueValues.slice(i, i + chunkSize);
      const part = await runChunk(chunk);
      aggregated.push(...part);
      chunks++;
    }
    try {
      this._provider.loggerRef?.crossQuery?.({
        op: 'IN-chunk',
        chunks,
        size: total,
        entity: ctorName(this._entityClass),
        column: String(property),
        provider: this._provider.providerLabel
      });
    } catch {
      /* ignore */
    }
    return aggregated;
  }

  /** Create a fluent `Queryable` for LINQ-like operations (EF-style) */
  public where(predicate: (entity: T) => boolean): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).where(predicate);

    return TypedQueryable.from(queryable);
  }

  /** Proxy: WHERE EXISTS (subquery). */
  public whereExists<TOther>(subquery: Queryable<TOther>): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).whereExists(subquery);

    return TypedQueryable.from(queryable);
  }
  /** Proxy: column IN (subquery). */
  public whereInSubquery<TOther>(
    column: keyof T & string,
    subquery: Queryable<TOther>
  ): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).whereInSubquery(column, subquery);

    return TypedQueryable.from(queryable);
  }

  /** Select specific properties (EF-style with type safety) */
  public select<TResult>(selector: (entity: T) => TResult): TypedQueryable<TResult> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).select(selector);

    return TypedQueryable.from(queryable);
  }

  /** Order by a property ascending */
  public orderBy<K extends keyof T>(key: K): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).orderBy(key);

    return TypedQueryable.from(queryable);
  }

  /** Order by a property descending */
  public orderByDescending<K extends keyof T>(key: K): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).orderByDescending(key);

    return TypedQueryable.from(queryable);
  }

  /** Take a specific number of entities (EF-style) */
  public take(count: number): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).take(count);

    return TypedQueryable.from(queryable);
  }

  /** Skip a specific number of entities (EF-style) */
  public skip(count: number): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).skip(count);

    return TypedQueryable.from(queryable);
  }

  /** Get distinct entities (EF-style) */
  public distinct(): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).distinct();

    return TypedQueryable.from(queryable);
  }

  /** Proxy: UNION of two queries of the same DbSet. */
  public union(other: Queryable<T>): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).union(other);

    return TypedQueryable.from(queryable);
  }
  /** Proxy: UNION ALL of two queries of the same DbSet. */
  public unionAll(other: Queryable<T>): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).unionAll(other);

    return TypedQueryable.from(queryable);
  }

  /** Get the first entity or throw if none exists */
  public async first(): Promise<T> {
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
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
      this._globalFilters,
      this._softDeleteOptions
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
      this._globalFilters,
      this._softDeleteOptions
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
      this._globalFilters,
      this._softDeleteOptions
    ).singleOrDefault();
  }

  /** Proxy: fallbackTo. */
  public fallbackTo(source: QueryFallback<T>): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).fallbackTo(source);

    return TypedQueryable.from(queryable);
  }

  /** Count entities */
  public async count(): Promise<number> {
    return await new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
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
      this._globalFilters,
      this._softDeleteOptions
    ).any();
  }

  /** Include related entities for eager loading */
  public include<K extends keyof T & string>(key: K): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    ).include(key);

    return TypedQueryable.from(queryable);
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

  private invalidateCountCache(): void {
    try {
      const extCount = this._performance?.countCache;
      if (!extCount?.invalidateBy) return;

      const providerLabel = this._provider.providerLabel;
      const providerPrefix = providerLabel ? `${providerLabel}|` : '';
      const ns = this._performance?.cacheNamespace ? `${this._performance.cacheNamespace}|` : '';
      const entityName = ctorName(this._entityClass);

      const prefix = `${ns}${providerPrefix}${entityName}|count|`;
      extCount.invalidateBy((key: string) => key.startsWith(prefix));
    } catch {
      // ignore errors during cache invalidation
    }
  }

  /** Upsert single entity by primary key existence check (ChangeTracker-based). */
  public async upsert(entity: T): Promise<T> {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || !metadata.primaryKeys || metadata.primaryKeys.length === 0)
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
    if (!metadata || !metadata.primaryKeys || metadata.primaryKeys.length === 0)
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
      // We can use findWhereIn SAFE wrapper logic (via Queryable) if we want soft delete check,
      // BUT for UPSERT, we probably want to find even deleted rows?
      // Soft Delete typically means "treat as missing for reads".
      // If we attempt to UPSERT a Soft-Deleted row... do we Revive it? Or insert a duplicate?
      // If Unique Key constraint exists on PK (it does), Insert will fail.
      // So Update is the only valid path.
      // If we Update a soft-deleted row, we might accidentally "undelete" it if we save isDeleted=0?
      // Or we just update other fields and it stays deleted?
      // For now, let's keep using direct provider access for UPSERT checks to ensure we find "physical" rows
      // because DB constraints don't care about soft delete.
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
