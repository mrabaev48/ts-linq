import type { DatabaseProvider } from '@ts-linq/core';
import type { EntityLoader } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { Queryable } from '@ts-linq/query';
import type { EntityCacheLike } from '@ts-linq/types';
import type { GlobalFilter, PerformanceOptions } from '@ts-linq/types';

import type { ChangeTracker } from './ChangeTracker';
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
  private static readonly DEFAULT_IN_CHUNK_SIZE = 1000;

  constructor(entityClass: new () => T, context: DbSetContext) {
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

  /** Returns a Queryable for this entity set — the single entry point for all querying. */
  public query(): Queryable<T> {
    return new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    );
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

  /** Upsert single entity by primary key existence check (ChangeTracker-based). */
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

  /** Upsert many entities via per-entity PK existence check. */
  public async upsertMany(entities: T[]): Promise<T[]> {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || !metadata.primaryKeys || metadata.primaryKeys.length === 0)
      throw new Error(`No primary key defined for ${this._entityClass.name}`);
    const pk = metadata.primaryKeys[0];
    const pairs: Array<{ entity: T; id: unknown }> = entities.map((e) => ({
      entity: e,
      id: (e as unknown as Record<string, unknown>)[pk]
    }));
    const ids = pairs.filter((p) => p.id !== undefined && p.id !== null).map((p) => p.id);
    if (ids.length > 0) {
      const pkCol = metadata.columns.find((c) => c.propertyName === pk);
      const chunkSize = this._performance?.inClauseChunkSize ?? DbSet.DEFAULT_IN_CHUNK_SIZE;
      const uniqueIds = Array.from(new Set(ids));
      const existingRows: T[] = [];
      for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        const part = await this._provider.findWhereIn(
          this._entityClass,
          pkCol ? pkCol.propertyName : pk,
          chunk
        );
        existingRows.push(...part);
      }
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
      this.addRange(entities);
    }
    return entities;
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
