import { DatabaseProvider } from '../providers/DatabaseProvider';
import { ChangeTracker } from '../change-tracking/ChangeTracker';
import { EntityLoader } from '../loading/EntityLoader';
import { LoadingOptions } from '../loading/LoadingStrategy';
import { Queryable } from '../query/Queryable';
import { EntityCache } from '../utils/EntityCache';
import { PerformanceOptions } from '../types';
import { LoadingStrategy } from '../loading/LoadingStrategy';

/**
 * Represents a typed set of entities and provides CRUD and LINQ-like operations
 * for a specific entity type.
 */
export class DbSet<T> {
    public _entityClass: new () => T;
    private _provider: DatabaseProvider;
    private _changeTracker: ChangeTracker;
    private _entityLoader: EntityLoader | undefined;
    private _entityCache: EntityCache | undefined;
    private _performance: PerformanceOptions | undefined;

    constructor(
        entityClass: new () => T,
        provider: DatabaseProvider,
        changeTracker: ChangeTracker,
        entityLoader?: EntityLoader,
        entityCache?: EntityCache,
        performance?: PerformanceOptions
    ) {
        this._entityClass = entityClass;
        this._provider = provider;
        this._changeTracker = changeTracker;
        this._entityLoader = entityLoader;
        this._entityCache = entityCache;
        this._performance = performance;
    }

    /**
     * Add an entity to be inserted
     * Similar to Entity Framework's Add method
     *
     * @param entity The entity instance to track as Added.
     * @returns The same entity instance for chaining.
     */
    public add(entity: T): T {
        this._changeTracker.add(entity, this._entityClass);
        return entity;
    }

    /**
     * Update an entity
     * Similar to Entity Framework's Update method
     *
     * @param entity The entity instance to track as Modified.
     * @returns The same entity instance for chaining.
     */
    public update(entity: T): T {
        this._changeTracker.update(entity, this._entityClass);
        return entity;
    }

    /**
     * Remove an entity
     * Similar to Entity Framework's Remove method
     *
     * @param entity The entity instance to track as Deleted.
     * @returns The same entity instance for chaining.
     */
    public remove(entity: T): T {
        this._changeTracker.remove(entity, this._entityClass);
        return entity;
    }

    /**
     * Find an entity by its primary key
     * Similar to Entity Framework's Find method
     *
     * @param id Primary key value.
     * @param options Optional loading options for eager loading.
     * @returns The found entity or null.
     */
    public async find(id: any, options?: LoadingOptions): Promise<T | null> {
        if (this._entityLoader && options) {
            return await this._entityLoader.loadEntity(this._entityClass, id, options);
        }
        return await this._provider.findById(id, this._entityClass);
    }

    /**
     * Get all entities
     * Similar to Entity Framework's ToList method
     *
     * @param options Optional loading options for eager loading.
     * @returns All entities for this set.
     */
    public async toArray(options?: LoadingOptions): Promise<T[]> {
        if (this._entityLoader && options) {
            return await this._entityLoader.loadEntities(this._entityClass, options);
        }
        return await this._provider.findAll(this._entityClass);
    }

    /**
     * Create a fluent `Queryable` for LINQ-like operations.
     *
     * @param predicate Predicate to start the query with.
     * @returns A `Queryable` configured with the predicate.
     * @example
     * const cheap = await context.products.where(p => p.price < 100).toArray();
     */
    public where(predicate: (entity: T) => boolean): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).where(predicate);
    }

    /**
     * Select specific properties
     *
     * @param selector Projection selector.
     * @returns A `Queryable` configured with the selection.
     * @example
     * const names = await context.authors.select(a => a.name).toArray();
     */
    public select<TResult>(selector: (entity: T) => TResult): Queryable<TResult> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).select(selector);
    }

    /**
     * Order by a property
     *
     * @param keySelector Sort key selector.
     * @returns A `Queryable` for chaining.
     * @example
     * const ordered = await context.books.orderBy(b => b.title).toArray();
     */
    public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).orderBy(keySelector);
    }

    /**
     * Order by descending
     *
     * @param keySelector Sort key selector.
     * @returns A `Queryable` for chaining.
     * @example
     * const latest = await context.books.orderByDescending(b => b.id).take(5).toArray();
     */
    public orderByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).orderByDescending(keySelector);
    }

    /**
     * Take a specific number of entities
     *
     * @param count Number of entities to take.
     * @returns A `Queryable` for chaining.
     * @example
     * const top10 = await context.products.take(10).toArray();
     */
    public take(count: number): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).take(count);
    }

    /**
     * Skip a specific number of entities
     *
     * @param count Number of entities to skip.
     * @returns A `Queryable` for chaining.
     * @example
     * const page2 = await context.products.orderBy(p => p.id).skip(10).take(10).toArray();
     */
    public skip(count: number): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).skip(count);
    }

    /**
     * Get distinct entities
     *
     * @returns A `Queryable` for chaining.
     * @example
     * const titles = await context.books.select(b => b.title).distinct().toArray();
     */
    public distinct(): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).distinct();
    }

    /**
     * Get the first entity or throw if none exists
     *
     * @returns The first entity.
     * @example
     * const first = await context.books.orderBy(b => b.id).first();
     */
    public async first(): Promise<T> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).first();
    }

    /**
     * Get the first entity or null if none exists
     *
     * @returns The first entity or null.
     * @example
     * const maybe = await context.books.where(b => b.id > 10000).firstOrDefault();
     */
    public async firstOrDefault(): Promise<T | null> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).firstOrDefault();
    }

    /**
     * Get a single entity or throw if none or multiple exist
     *
     * @returns The single entity.
     * @example
     * const book = await context.books.where(b => b.id === 1).single();
     */
    public async single(): Promise<T> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).single();
    }

    /**
     * Get a single entity or null if none exists, throw if multiple exist
     *
     * @returns The single entity or null.
     * @example
     * const maybe = await context.books.where(b => b.id === 9999).singleOrDefault();
     */
    public async singleOrDefault(): Promise<T | null> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).singleOrDefault();
    }

    /**
     * Count entities
     *
     * @returns Total number of entities matching the current query.
     * @example
     * const count = await context.products.where(p => p.price >= 100).count();
     */
    public async count(): Promise<number> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).count();
    }

    /**
     * Check if any entities exist
     *
     * @returns True if at least one entity exists.
      * @example
      * const exists = await context.products.where(p => p.name === 'Laptop').any();
     */
    public async any(): Promise<boolean> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance).any();
    }

    /**
     * Start a query with eager includes using a property selector.
     * Must be called before where/select/orderBy... to be applied.
     * @example
     * const authors = await context.authors.include(a => a.books).where(a => a.id === 1).toArray();
     */
    public include(selector: (entity: T) => any): Queryable<T> {
        const qb = new Queryable<T>(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance);
        return qb.include(selector);
    }
}
