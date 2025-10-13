import type { DatabaseProvider } from '@ts-linq/core';
import type { ChangeTracker } from '../change-tracking/ChangeTracker';
import type { EntityLoader } from '../loading/EntityLoader';
import type { LoadingOptions } from '../loading/LoadingStrategy';
import type {
  PrimaryKeyOf,
  EntityCacheLike,
  PerformanceOptions,
  GlobalFilter
} from '@ts-linq/core';
import { Queryable, TypedQueryable } from '@ts-linq/core';
import { LoadingStrategy } from '../loading/LoadingStrategy';
import { MetadataStorage } from '@ts-linq/core';

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

  public add(entity: T): T {
    this._changeTracker.add(entity, this._entityClass);
    return entity;
  }

  public update(entity: T): T {
    this._changeTracker.update(entity, this._entityClass);
    return entity;
  }

  public remove(entity: T): T {
    this._changeTracker.remove(entity, this._entityClass);
    return entity;
  }

  public addRange(entities: T[]): T[] {
    for (const e of entities) this.add(e);
    return entities;
  }

  public updateRange(entities: T[]): T[] {
    for (const e of entities) this.update(e);
    return entities;
  }

  public removeRange(entities: T[]): T[] {
    for (const e of entities) this.remove(e);
    return entities;
  }

  public async find(id: PrimaryKeyOf<T>, options?: LoadingOptions): Promise<T | null> {
    const entity = await this._provider.findById(id as unknown, this._entityClass);
    if (!entity) return null;
    return await this.applyLoading(entity, options);
  }

  public async toArray(options?: LoadingOptions): Promise<T[]> {
    const entities = await this._provider.findAll(this._entityClass);
    return await this.applyLoadingMany(entities, options);
  }

  public async findByIds(ids: ReadonlyArray<PrimaryKeyOf<T>>): Promise<T[]> {
    if (ids.length === 0) return [];
    const pk = MetadataStorage.getEntity(this._entityClass)?.primaryKeys[0];
    if (!pk) return [];
    const col =
      MetadataStorage.getEntity(this._entityClass)?.columns.find((c) => c.propertyName === pk)
        ?.columnName || pk;
    const rows = await this._provider.findWhereIn(this._entityClass, col, ids as unknown[]);
    return this.applyLoadingMany(rows, { strategy: LoadingStrategy.Eager });
  }

  public query(): TypedQueryable<T> {
    const raw = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    );
    return TypedQueryable.from(raw);
  }

  // Queryable delegations (fluent API)
  public where(predicate: (entity: T) => boolean): TypedQueryable<T> {
    return this.query().where(predicate);
  }
  public orderBy<TKey>(keySelector: (entity: T) => TKey): TypedQueryable<T> {
    return this.query().orderBy(keySelector);
  }
  public orderByDescending<TKey>(keySelector: (entity: T) => TKey): TypedQueryable<T> {
    return this.query().orderBy(keySelector as never, 'DESC');
  }
  public thenBy<TKey>(keySelector: (entity: T) => TKey): TypedQueryable<T> {
    return this.query()
      .orderBy(
        (x) =>
          (x as unknown as Record<string, unknown>)[
            String(keySelector as unknown as string)
          ] as T[keyof T]
      )
      .thenBy(keySelector as never);
  }
  public thenByDescending<TKey>(keySelector: (entity: T) => TKey): TypedQueryable<T> {
    return this.query()
      .orderBy(
        (x) =>
          (x as unknown as Record<string, unknown>)[
            String(keySelector as unknown as string)
          ] as T[keyof T]
      )
      .thenByDescending(keySelector as never);
  }
  public take(count: number): TypedQueryable<T> {
    return this.query().take(count);
  }
  public skip(count: number): TypedQueryable<T> {
    return this.query().skip(count);
  }
  public distinct(): TypedQueryable<T> {
    return this.query().distinct();
  }
  public select<TResult>(selector: (entity: T) => TResult): TypedQueryable<TResult> {
    return this.query().select(selector);
  }
  public union(other: TypedQueryable<T>): TypedQueryable<T> {
    return this.query().union(other as unknown as Queryable<T>) as unknown as TypedQueryable<T>;
  }
  public unionAll(other: TypedQueryable<T>): TypedQueryable<T> {
    return this.query().unionAll(other as unknown as Queryable<T>) as unknown as TypedQueryable<T>;
  }
  public async count(): Promise<number> {
    return await this.query().count();
  }
  public async any(): Promise<boolean> {
    return await this.query().any();
  }
  public async first(): Promise<T> {
    return await this.query().first();
  }
  public async firstOrDefault(): Promise<T | null> {
    return await this.query().firstOrDefault();
  }
  public async single(): Promise<T> {
    return await this.query().single();
  }
  public async singleOrDefault(): Promise<T | null> {
    return await this.query().singleOrDefault();
  }
  public include(selector: (entity: T) => unknown): TypedQueryable<T> {
    return this.query().include(selector);
  }
  public async findWhereIn(propertyName: keyof T & string, values: unknown[]): Promise<T[]> {
    const meta = MetadataStorage.getEntity(this._entityClass);
    if (!meta) return [];
    const col =
      meta.columns.find((c) => c.propertyName === propertyName)?.columnName || propertyName;
    const rows = await this._provider.findWhereIn(this._entityClass, col, values);
    return this.applyLoadingMany(rows, { strategy: LoadingStrategy.Eager });
  }
  public async upsert(entity: T): Promise<T> {
    const meta = MetadataStorage.getEntity(this._entityClass);
    if (!meta) return entity;
    const pk = meta.primaryKeys[0];
    const id = (entity as unknown as Record<string, unknown>)[pk];
    if (id === undefined || id === null) {
      return await this._provider.insert(entity, this._entityClass);
    }
    const exists = await this._provider.findById(id as unknown, this._entityClass);
    if (exists) return await this._provider.update(entity, this._entityClass);
    return await this._provider.insert(entity, this._entityClass);
  }
  public async upsertMany(entities: T[]): Promise<T[]> {
    if (entities.length === 0) return [];
    const meta = MetadataStorage.getEntity(this._entityClass);
    if (!meta) return entities;
    const pk = meta.primaryKeys[0];
    const withId = entities
      .map((e) => ({ e, id: (e as unknown as Record<string, unknown>)[pk] }))
      .filter((x) => x.id !== undefined && x.id !== null);
    const ids = withId.map((x) => x.id);
    const existing = ids.length ? await this._provider.findWhereIn(this._entityClass, pk, ids) : [];
    const existingSet = new Set(
      existing.map((row) => (row as unknown as Record<string, unknown>)[pk])
    );
    const result: T[] = [];
    for (const { e, id } of withId) {
      if (existingSet.has(id)) result.push(await this._provider.update(e, this._entityClass));
      else result.push(await this._provider.insert(e, this._entityClass));
    }
    for (const e of entities) {
      const id = (e as unknown as Record<string, unknown>)[pk];
      if (id === undefined || id === null)
        result.push(await this._provider.insert(e, this._entityClass));
    }
    return result;
  }
  public async insertMany(entities: T[]): Promise<T[]> {
    const inserted: T[] = [];
    for (const e of entities) inserted.push(await this._provider.insert(e, this._entityClass));
    return inserted;
  }
  public async updateMany(entities: T[]): Promise<T[]> {
    const updated: T[] = [];
    for (const e of entities) updated.push(await this._provider.update(e, this._entityClass));
    return updated;
  }
  public async paginate(
    page: number,
    size: number
  ): Promise<{ items: T[]; total: number; page: number; size: number }> {
    return await this.query().paginate(page, size);
  }
  public async keysetPaginate<TKey extends keyof T>(
    key: TKey,
    after: T[TKey] | null,
    size: number
  ): Promise<{ items: T[]; pageSize: number; nextAfter: T[TKey] | null }> {
    return await this.query().keysetPaginate(key as string as never, after as never, size);
  }

  private async applyLoading(entity: T, options?: LoadingOptions): Promise<T> {
    const strategy = options?.strategy ?? (this._entityLoader ? LoadingStrategy.Eager : undefined);
    // Note: EntityLoader in core exposes high-level load methods; for simplicity here we skip
    // invoking internal methods and just return the entity. Eager loading is handled by queries.
    return entity;
  }

  private async applyLoadingMany(entities: T[], options?: LoadingOptions): Promise<T[]> {
    if (entities.length === 0) return entities;
    const strategy = options?.strategy ?? (this._entityLoader ? LoadingStrategy.Eager : undefined);
    // See note above: eager loading resolved at query time.
    return entities;
  }
}
