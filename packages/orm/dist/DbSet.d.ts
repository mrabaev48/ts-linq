import type { DatabaseProvider } from '@ts-linq/core';
import { ChangeTracker } from './ChangeTracker';
import { EntityLoader } from '@ts-linq/core';
import type { LoadingOptions } from '@ts-linq/core';
import { Queryable } from '@ts-linq/query';
import { TypedQueryable } from '@ts-linq/query';
import type { EntityCacheLike } from '@ts-linq/core';
import type { GlobalFilter, PerformanceOptions } from '@ts-linq/types';
import type { PrimaryKeyOf } from '@ts-linq/core';
/**
 * Represents a typed set of entities and provides CRUD and LINQ-like operations
 * for a specific entity type.
 */
export declare class DbSet<T extends object> {
    _entityClass: new () => T;
    private _provider;
    private _changeTracker;
    private _entityLoader;
    private _entityCache;
    private _performance;
    private _globalFilters;
    private static readonly DEFAULT_IN_CHUNK_SIZE;
    constructor(entityClass: new () => T, provider: DatabaseProvider, changeTracker: ChangeTracker, entityLoader?: EntityLoader, entityCache?: EntityCacheLike, performance?: PerformanceOptions, globalFilters?: GlobalFilter[]);
    /** Add an entity to be inserted */
    add(entity: T): T;
    /** Update an entity */
    update(entity: T): T;
    /** Remove an entity */
    remove(entity: T): T;
    /** Add multiple entities at once to ChangeTracker. */
    addRange(entities: T[]): T[];
    /** Update multiple entities at once to ChangeTracker. */
    updateRange(entities: T[]): T[];
    /** Remove multiple entities at once to ChangeTracker. */
    removeRange(entities: T[]): T[];
    /** Find an entity by its primary key (convention: property named `id`) */
    find(id: PrimaryKeyOf<T>, options?: LoadingOptions): Promise<T | null>;
    /** Get all entities */
    toArray(options?: LoadingOptions): Promise<T[]>;
    /** Fetch multiple entities by their primary keys in one query when supported. */
    findByIds(ids: ReadonlyArray<PrimaryKeyOf<T>>): Promise<T[]>;
    /**
     * Type-safe IN query by entity property. Maps property to column via metadata.
     * Example: users.findWhereIn('id', [userId]) or users.findWhereIn('name', ['Alice'])
     */
    findWhereIn<K extends keyof T & string>(property: K, values: ReadonlyArray<T[K]>): Promise<T[]>;
    /** Create a fluent `TypedQueryable` for LINQ-like operations (EF-style) */
    where(predicate: (entity: T) => boolean): TypedQueryable<T>;
    /** Proxy: WHERE EXISTS (subquery). */
    whereExists<TOther>(subquery: Queryable<TOther>): TypedQueryable<T>;
    /** Proxy: column IN (subquery). */
    whereInSubquery<TOther>(column: keyof T & string, subquery: Queryable<TOther>): TypedQueryable<T>;
    /** Select specific properties (EF-style with type safety) */
    select<TResult>(selector: (entity: T) => TResult): TypedQueryable<TResult>;
    /** Order by a property (EF-style with type safety) */
    orderBy<TKey>(keySelector: (entity: T) => TKey): TypedQueryable<T>;
    /** Order by descending (EF-style with type safety) */
    orderByDescending<TKey>(keySelector: (entity: T) => TKey): TypedQueryable<T>;
    /** Take a specific number of entities (EF-style) */
    take(count: number): TypedQueryable<T>;
    /** Skip a specific number of entities (EF-style) */
    skip(count: number): TypedQueryable<T>;
    /** Get distinct entities (EF-style) */
    distinct(): TypedQueryable<T>;
    /** Proxy: UNION of two queries of the same DbSet. */
    union(other: Queryable<T>): TypedQueryable<T>;
    /** Proxy: UNION ALL of two queries of the same DbSet. */
    unionAll(other: Queryable<T>): TypedQueryable<T>;
    /** Get the first entity or throw if none exists */
    first(): Promise<T>;
    /** Get the first entity or null if none exists */
    firstOrDefault(): Promise<T | null>;
    /** Get a single entity or throw if none or multiple exist */
    single(): Promise<T>;
    /** Get a single entity or null if none exists, throw if multiple exist */
    singleOrDefault(): Promise<T | null>;
    /** Count entities */
    count(): Promise<number>;
    /** Check if any entities exist */
    any(): Promise<boolean>;
    /** Start a query with eager includes using a property selector. */
    /** Include related entities for eager loading (EF-style with type safety) */
    include(selector: (entity: T) => unknown): TypedQueryable<T>;
    /** Provider-level bulk insert within a transaction. */
    insertMany(entities: T[]): Promise<T[]>;
    /** Provider-level bulk update within a transaction. */
    updateMany(entities: T[]): Promise<T[]>;
    /** Upsert single entity by primary key existence check (ChangeTracker-based). */
    upsert(entity: T): Promise<T>;
    /** Upsert many entities via per-entity PK existence check. */
    upsertMany(entities: T[]): Promise<T[]>;
}
//# sourceMappingURL=DbSet.d.ts.map