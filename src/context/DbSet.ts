import { DatabaseProvider } from '../providers/DatabaseProvider';
import { ChangeTracker } from '../change-tracking/ChangeTracker';
import { EntityLoader } from '../loading/EntityLoader';
import { LoadingOptions } from '../loading/LoadingStrategy';
import { Queryable } from '../query/Queryable';
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

    constructor(
        entityClass: new () => T,
        provider: DatabaseProvider,
        changeTracker: ChangeTracker,
        entityLoader?: EntityLoader
    ) {
        this._entityClass = entityClass;
        this._provider = provider;
        this._changeTracker = changeTracker;
        this._entityLoader = entityLoader;
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
     * Create a query builder for LINQ-like operations
     * Similar to Entity Framework's LINQ queries
     *
     * @param predicate Predicate to start the query with.
     * @returns A `QueryBuilder` configured with the predicate.
     */
    public where(predicate: (entity: T) => boolean): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader).where(predicate);
    }

    /**
     * Select specific properties
     *
     * @param selector Projection selector.
     * @returns A `QueryBuilder` configured with the selection.
     */
    public select<TResult>(selector: (entity: T) => TResult): Queryable<TResult> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader).select(selector);
    }

    /**
     * Order by a property
     *
     * @param keySelector Sort key selector.
     * @returns This `QueryBuilder` for chaining.
     */
    public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader).orderBy(keySelector);
    }

    /**
     * Order by descending
     *
     * @param keySelector Sort key selector.
     * @returns This `QueryBuilder` for chaining.
     */
    public orderByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader).orderByDescending(keySelector);
    }

    /**
     * Take a specific number of entities
     *
     * @param count Number of entities to take.
     * @returns This `QueryBuilder` for chaining.
     */
    public take(count: number): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader).take(count);
    }

    /**
     * Skip a specific number of entities
     *
     * @param count Number of entities to skip.
     * @returns This `QueryBuilder` for chaining.
     */
    public skip(count: number): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader).skip(count);
    }

    /**
     * Get distinct entities
     *
     * @returns This `QueryBuilder` for chaining.
     */
    public distinct(): Queryable<T> {
        return new Queryable<T>(this._entityClass, this._provider, this._entityLoader).distinct();
    }

    /**
     * Get the first entity or throw if none exists
     *
     * @returns The first entity.
     */
    public async first(): Promise<T> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader).first();
    }

    /**
     * Get the first entity or null if none exists
     *
     * @returns The first entity or null.
     */
    public async firstOrDefault(): Promise<T | null> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader).firstOrDefault();
    }

    /**
     * Get a single entity or throw if none or multiple exist
     *
     * @returns The single entity.
     */
    public async single(): Promise<T> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader).single();
    }

    /**
     * Get a single entity or null if none exists, throw if multiple exist
     *
     * @returns The single entity or null.
     */
    public async singleOrDefault(): Promise<T | null> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader).singleOrDefault();
    }

    /**
     * Count entities
     *
     * @returns Total number of entities matching the current query.
     */
    public async count(): Promise<number> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader).count();
    }

    /**
     * Check if any entities exist
     *
     * @returns True if at least one entity exists.
     */
    public async any(): Promise<boolean> {
        return await new Queryable<T>(this._entityClass, this._provider, this._entityLoader).any();
    }

    /**
     * Start a query with eager includes using a property selector.
     * Must be called before where/select/orderBy... to be applied.
     */
    public include(selector: (entity: T) => any): Queryable<T> {
        const qb = new Queryable<T>(this._entityClass, this._provider, this._entityLoader);
        return qb.include(selector);
    }
}
