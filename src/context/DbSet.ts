import { DatabaseProvider } from '../providers/DatabaseProvider';
import { ChangeTracker } from '../change-tracking/ChangeTracker';
import { EntityLoader } from '../loading/EntityLoader';
import { LoadingOptions } from '../loading/LoadingStrategy';
import { QueryBuilder } from '../query/QueryBuilder';

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
     */
    public add(entity: T): T {
        this._changeTracker.add(entity, this._entityClass);
        return entity;
    }

    /**
     * Update an entity
     * Similar to Entity Framework's Update method
     */
    public update(entity: T): T {
        this._changeTracker.update(entity, this._entityClass);
        return entity;
    }

    /**
     * Remove an entity
     * Similar to Entity Framework's Remove method
     */
    public remove(entity: T): T {
        this._changeTracker.remove(entity, this._entityClass);
        return entity;
    }

    /**
     * Find an entity by its primary key
     * Similar to Entity Framework's Find method
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
     */
    public where(predicate: (entity: T) => boolean): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).where(predicate);
    }

    /**
     * Select specific properties
     */
    public select<TResult>(selector: (entity: T) => TResult): QueryBuilder<TResult> {
        return new QueryBuilder<T>(this._entityClass, this._provider).select(selector);
    }

    /**
     * Order by a property
     */
    public orderBy<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).orderBy(keySelector);
    }

    /**
     * Order by descending
     */
    public orderByDescending<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).orderByDescending(keySelector);
    }

    /**
     * Take a specific number of entities
     */
    public take(count: number): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).take(count);
    }

    /**
     * Skip a specific number of entities
     */
    public skip(count: number): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).skip(count);
    }

    /**
     * Get distinct entities
     */
    public distinct(): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).distinct();
    }

    /**
     * Get the first entity or throw if none exists
     */
    public async first(): Promise<T> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).first();
    }

    /**
     * Get the first entity or null if none exists
     */
    public async firstOrDefault(): Promise<T | null> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).firstOrDefault();
    }

    /**
     * Get a single entity or throw if none or multiple exist
     */
    public async single(): Promise<T> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).single();
    }

    /**
     * Get a single entity or null if none exists, throw if multiple exist
     */
    public async singleOrDefault(): Promise<T | null> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).singleOrDefault();
    }

    /**
     * Count entities
     */
    public async count(): Promise<number> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).count();
    }

    /**
     * Check if any entities exist
     */
    public async any(): Promise<boolean> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).any();
    }
}
