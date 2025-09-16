import type { DatabaseProvider } from '../DatabaseProvider';
import type { ChangeTracker } from '../change-tracking/ChangeTracker';
import type { EntityLoader } from '../loading/EntityLoader';
import type { LoadingOptions } from '../loading/LoadingStrategy';
import { Queryable } from '../query/Queryable';
import type { EntityCacheLike } from '../utils/EntityCache';
import type { PerformanceOptions, GlobalFilter } from '../types';
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
    /** Find an entity by its primary key */
    find(id: unknown, options?: LoadingOptions): Promise<T | null>;
    /** Get all entities */
    toArray(options?: LoadingOptions): Promise<T[]>;
    /** Create a fluent `Queryable` for LINQ-like operations. */
    where(predicate: (entity: T) => boolean): Queryable<T>;
    /** Proxy: WHERE EXISTS (subquery). */
    whereExists<TOther>(subquery: Queryable<TOther>): Queryable<T>;
    /** Proxy: column IN (subquery). */
    whereInSubquery<TOther>(column: keyof T & string, subquery: Queryable<TOther>): Queryable<T>;
    /** Select specific properties */
    select<TResult>(selector: (entity: T) => TResult): Queryable<TResult>;
    /** Order by a property */
    orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T>;
    /** Order by descending */
    orderByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T>;
    /** Take a specific number of entities */
    take(count: number): Queryable<T>;
    /** Skip a specific number of entities */
    skip(count: number): Queryable<T>;
    /** Get distinct entities */
    distinct(): Queryable<T>;
    /** Proxy: UNION of two queries of the same DbSet. */
    union(other: Queryable<T>): Queryable<T>;
    /** Proxy: UNION ALL of two queries of the same DbSet. */
    unionAll(other: Queryable<T>): Queryable<T>;
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
    include(selector: (entity: T) => unknown): Queryable<T>;
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