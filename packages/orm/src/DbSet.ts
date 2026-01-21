import type { DatabaseProvider } from '@ts-linq/core';
import { ChangeTracker } from './ChangeTracker';
import { EntityLoader } from '@ts-linq/core';
import type { LoadingOptions } from '@ts-linq/core';
import { LoadingStrategy } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { Queryable, TypedQueryable } from '@ts-linq/query';
import type { EntityCacheLike } from '@ts-linq/types';
import type { GlobalFilter, PerformanceOptions } from '@ts-linq/types';
import type { PrimaryKeyOf } from '@ts-linq/core';

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
  // Default chunk size; can be overridden via PerformanceOptions.inClauseChunkSize
  private static readonly DEFAULT_IN_CHUNK_SIZE = 1000;

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
      this._globalFilters
    )
      .where((e: any) => (e as unknown as Record<string, unknown>)[pk] === id)
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

  /** Fetch multiple entities by their primary keys in one query when supported. */
  public async findByIds(ids: ReadonlyArray<PrimaryKeyOf<T>>): Promise<T[]> {
    if (!ids || ids.length === 0) return [];
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || !metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      // Fallback: issue sequential finds (kept for completeness; generally not used)
      const results: T[] = [];
      for (const id of ids) {
        const found = await this.find(id);
        if (found) results.push(found);
      }
      return results;
    }
    const pk = metadata.primaryKeys[0];
    const column = metadata.columns.find((c: any) => c.propertyName === pk)?.columnName || pk;
    // Cross-query optimization: deduplicate and chunk large IN lists
    const uniqueIds = Array.from(new Set(ids as unknown as unknown[]));
    if (uniqueIds.length === 0) return [];
    const chunkSize = (this._performance as any)?.inClauseChunkSize ?? DbSet.DEFAULT_IN_CHUNK_SIZE;
    if (uniqueIds.length <= chunkSize) {
      return await this._provider.findWhereIn(
        this._entityClass,
        column,
        uniqueIds as unknown as unknown[]
      );
    }
    const aggregated: T[] = [];
    const total = uniqueIds.length;
    let chunks = 0;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const part = await this._provider.findWhereIn(
        this._entityClass,
        column,
        chunk as unknown as unknown[]
      );
      aggregated.push(...part);
      chunks++;
    }
    try {
      (
        this._provider.loggerRef as unknown as {
          crossQuery?: (p: {
            op: 'IN-chunk';
            chunks: number;
            size: number;
            entity: string;
            column: string;
            provider?: string;
          }) => void;
        }
      )?.crossQuery?.({
        op: 'IN-chunk',
        chunks,
        size: total,
        entity: (this._entityClass as unknown as { name?: string }).name || 'Unknown',
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
    const metadata = MetadataStorage.getEntity(this._entityClass);
    const columnName = metadata
      ? metadata.columns.find((c: any) => c.propertyName === property || c.columnName === property)
          ?.columnName || String(property)
      : String(property);
    // Cross-query optimization: deduplicate inputs and split into chunks
    const uniqueValues = Array.from(new Set(values as unknown as unknown[]));
    if (uniqueValues.length === 0) return [];
    const chunkSize = (this._performance as any)?.inClauseChunkSize ?? DbSet.DEFAULT_IN_CHUNK_SIZE;
    if (uniqueValues.length <= chunkSize) {
      return await this._provider.findWhereIn(
        this._entityClass as unknown as new () => T,
        columnName,
        uniqueValues as unknown as unknown[]
      );
    }
    const aggregated: T[] = [];
    const total = uniqueValues.length;
    let chunks = 0;
    for (let i = 0; i < uniqueValues.length; i += chunkSize) {
      const chunk = uniqueValues.slice(i, i + chunkSize);
      const part = await this._provider.findWhereIn(
        this._entityClass as unknown as new () => T,
        columnName,
        chunk as unknown as unknown[]
      );
      aggregated.push(...part);
      chunks++;
    }
    try {
      (
        this._provider.loggerRef as unknown as {
          crossQuery?: (p: {
            op: 'IN-chunk';
            chunks: number;
            size: number;
            entity: string;
            column: string;
            provider?: string;
          }) => void;
        }
      )?.crossQuery?.({
        op: 'IN-chunk',
        chunks,
        size: total,
        entity: (this._entityClass as unknown as { name?: string }).name || 'Unknown',
        column: columnName,
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
      this._globalFilters
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
      this._globalFilters
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
      this._globalFilters
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
      this._globalFilters
    ).select(selector);

    return TypedQueryable.from(queryable);
  }

  /** Order by a property (EF-style with type safety) */
  public orderBy<TKey>(keySelector: (entity: T) => TKey): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).orderBy(keySelector);

    return TypedQueryable.from(queryable);
  }

  /** Order by descending (EF-style with type safety) */
  public orderByDescending<TKey>(keySelector: (entity: T) => TKey): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).orderByDescending(keySelector);

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
      this._globalFilters
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
      this._globalFilters
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
      this._globalFilters
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
      this._globalFilters
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
      this._globalFilters
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

  /** Proxy: fallbackTo. */
  public fallbackTo(source: any): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
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
  /** Include related entities for eager loading (EF-style with type safety) */
  public include(selector: (entity: T) => unknown): TypedQueryable<T> {
    const queryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).include(selector);

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
      // Check if count cache has invalidateBy method (custom or standard interface)
      if (!extCount || typeof (extCount as any).invalidateBy !== 'function') return;

      const providerLabel = this._provider.providerLabel;
      const providerPrefix = providerLabel ? `${providerLabel}|` : '';
      const ns = this._performance?.cacheNamespace ? `${this._performance.cacheNamespace}|` : '';
      const entityName = (this._entityClass as any).name;

      const prefix = `${ns}${providerPrefix}${entityName}|count|`;
      (extCount as any).invalidateBy((key: string) => key.startsWith(prefix));
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
    const pairs: Array<{ entity: T; id: unknown }> = entities.map((e: any) => ({
      entity: e,
      id: (e as unknown as Record<string, unknown>)[pk]
    }));
    const ids = pairs.filter((p) => p.id !== undefined && p.id !== null).map((p) => p.id);
    if (ids.length > 0) {
      // Fetch existing ids in one go if provider supports findWhereIn for PK column
      const pkCol = metadata.columns.find((c: any) => c.propertyName === pk);
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
