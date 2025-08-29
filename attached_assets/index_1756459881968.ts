/**
 * Change tracking states similar to Entity Framework
 */
export enum EntityState {
    Unchanged = 'unchanged',
    Added = 'added',
    Modified = 'modified',
    Deleted = 'deleted'
}

export interface TrackedEntity {
    entity: any;
    entityClass: Function;
    state: EntityState;
    originalValues?: any;
}

/**
 * ChangeTracker class similar to Entity Framework's ChangeTracker
 * Tracks entity state changes for SaveChanges operation
 */
export class ChangeTracker {
    private _trackedEntities: Map<any, TrackedEntity> = new Map();

    /**
     * Add an entity to be tracked as Added
     */
    public add(entity: any, entityClass: Function): void {
        this._trackedEntities.set(entity, {
            entity,
            entityClass,
            state: EntityState.Added
        });
    }

    /**
     * Track an entity as Modified
     */
    public update(entity: any, entityClass: Function): void {
        const existing = this._trackedEntities.get(entity);
        if (existing) {
            existing.state = EntityState.Modified;
        } else {
            this._trackedEntities.set(entity, {
                entity,
                entityClass,
                state: EntityState.Modified,
                originalValues: this.cloneObject(entity)
            });
        }
    }

    /**
     * Track an entity as Deleted
     */
    public remove(entity: any, entityClass: Function): void {
        const existing = this._trackedEntities.get(entity);
        if (existing) {
            existing.state = EntityState.Deleted;
        } else {
            this._trackedEntities.set(entity, {
                entity,
                entityClass,
                state: EntityState.Deleted
            });
        }
    }

    /**
     * Track an entity as Unchanged (loaded from database)
     */
    public attach(entity: any, entityClass: Function): void {
        this._trackedEntities.set(entity, {
            entity,
            entityClass,
            state: EntityState.Unchanged,
            originalValues: this.cloneObject(entity)
        });
    }

    /**
     * Get all tracked changes
     */
    public getChanges(): TrackedEntity[] {
        return Array.from(this._trackedEntities.values())
            .filter(tracked => tracked.state !== EntityState.Unchanged);
    }

    /**
     * Get the state of a specific entity
     */
    public getEntityState(entity: any): EntityState {
        const tracked = this._trackedEntities.get(entity);
        return tracked ? tracked.state : EntityState.Unchanged;
    }

    /**
     * Accept all changes and reset tracking
     */
    public acceptAllChanges(): void {
        for (const tracked of this._trackedEntities.values()) {
            if (tracked.state === EntityState.Deleted) {
                this._trackedEntities.delete(tracked.entity);
            } else {
                tracked.state = EntityState.Unchanged;
                tracked.originalValues = this.cloneObject(tracked.entity);
            }
        }
    }

    /**
     * Clear all tracked entities
     */
    public clear(): void {
        this._trackedEntities.clear();
    }

    /**
     * Detect changes in tracked entities
     */
    public detectChanges(): void {
        for (const tracked of this._trackedEntities.values()) {
            if (tracked.state === EntityState.Unchanged && tracked.originalValues) {
                if (!this.areObjectsEqual(tracked.entity, tracked.originalValues)) {
                    tracked.state = EntityState.Modified;
                }
            }
        }
    }

    /**
     * Clone an object for original values tracking
     */
    private cloneObject(obj: any): any {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Compare two objects for equality
     */
    private areObjectsEqual(obj1: any, obj2: any): boolean {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    }
}

export interface DbContextOptions {
    connectionString: string;
    provider?: 'sqlite' | 'mysql' | 'postgresql';
}

/**
 * Base DbContext class similar to Entity Framework's DbContext
 * Manages database connections, change tracking, and entity sets
 */
export abstract class DbContext {
    private _provider: DatabaseProvider;
    private _changeTracker: ChangeTracker;
    private _entityLoader: EntityLoader;
    private _dbSets: Map<Function, DbSet<any>> = new Map();
    private _defaultLoadingStrategy: LoadingStrategy = LoadingStrategy.Lazy;

    constructor(options: DbContextOptions) {
        // Initialize database provider based on options
        switch (options.provider || 'sqlite') {
            case 'sqlite':
                this._provider = new SQLiteProvider(options.connectionString);
                break;
            default:
                throw new Error(`Provider ${options.provider} is not supported`);
        }

        this._changeTracker = new ChangeTracker();
        this._entityLoader = new EntityLoader(this._provider);
        this.initializeDbSets();
    }

    /**
     * Get a DbSet for the specified entity type
     */
    public set<T>(entityClass: new () => T): DbSet<T> {
        if (!this._dbSets.has(entityClass)) {
            throw new Error(`DbSet for ${entityClass.name} is not configured`);
        }
        return this._dbSets.get(entityClass) as DbSet<T>;
    }

    /**
     * Initialize the database and create tables
     */
    public async ensureCreated(): Promise<void> {
        await this._provider.connect();

        const entities = MetadataStorage.getEntities();
        for (const entity of entities) {
            await this._provider.createTable(entity);
        }
    }

    /**
     * Save all changes tracked by the change tracker
     * Similar to Entity Framework's SaveChanges()
     */
    public async saveChanges(): Promise<number> {
        const changes = this._changeTracker.getChanges();
        let affectedRows = 0;

        for (const change of changes) {
            switch (change.state) {
                case 'added':
                    await this._provider.insert(change.entity, change.entityClass);
                    affectedRows++;
                    break;
                case 'modified':
                    await this._provider.update(change.entity, change.entityClass);
                    affectedRows++;
                    break;
                case 'deleted':
                    await this._provider.delete(change.entity, change.entityClass);
                    affectedRows++;
                    break;
            }
        }

        this._changeTracker.acceptAllChanges();
        return affectedRows;
    }

    /**
     * Start a database transaction
     */
    public async beginTransaction(): Promise<void> {
        await this._provider.beginTransaction();
    }

    /**
     * Commit the current transaction
     */
    public async commitTransaction(): Promise<void> {
        await this._provider.commitTransaction();
    }

    /**
     * Rollback the current transaction
     */
    public async rollbackTransaction(): Promise<void> {
        await this._provider.rollbackTransaction();
    }

    /**
     * Dispose of the database connection
     */
    public async dispose(): Promise<void> {
        await this._provider.disconnect();
    }

    /**
     * Get the underlying database provider
     */
    protected get provider(): DatabaseProvider {
        return this._provider;
    }

    /**
     * Get the change tracker
     */
    protected get changeTracker(): ChangeTracker {
        return this._changeTracker;
    }

    /**
     * Get the entity loader
     */
    protected get entityLoader(): EntityLoader {
        return this._entityLoader;
    }

    /**
     * Set the default loading strategy
     */
    public setLoadingStrategy(strategy: LoadingStrategy): void {
        this._defaultLoadingStrategy = strategy;
        this._entityLoader.setDefaultStrategy(strategy);
    }

    /**
     * Find an entity by ID with loading options
     */
    public async find<T>(
        entityClass: new () => T,
        id: any,
        options?: LoadingOptions
    ): Promise<T | null> {
        const loadingOptions = {
            strategy: this._defaultLoadingStrategy,
            ...options
        };
        return await this._entityLoader.loadEntity(entityClass, id, loadingOptions);
    }

    /**
     * Find entities with loading options
     */
    public async findAll<T>(
        entityClass: new () => T,
        options?: LoadingOptions
    ): Promise<T[]> {
        const loadingOptions = {
            strategy: this._defaultLoadingStrategy,
            ...options
        };
        return await this._entityLoader.loadEntities(entityClass, loadingOptions);
    }

    /**
     * Include related entities in the query (eager loading)
     */
    public include<T>(entityClass: new () => T, ...includes: string[]): DbSetWithIncludes<T> {
        const dbSet = this.set(entityClass);
        return new DbSetWithIncludes(dbSet, includes, this._entityLoader);
    }

    /**
     * Initialize DbSets for all registered entities
     */
    private initializeDbSets(): void {
        const entities = MetadataStorage.getEntities();

        for (const entity of entities) {
            const dbSet = new DbSet<any>(entity.target, this._provider, this._changeTracker, this._entityLoader);
            this._dbSets.set(entity.target, dbSet);

            // Create property on context instance for easy access
            const propertyName = entity.target.name.toLowerCase() + 's';
            Object.defineProperty(this, propertyName, {
                get: () => dbSet,
                enumerable: true,
                configurable: false
            });
        }
    }
}


/**
 * DbSet class similar to Entity Framework's DbSet<T>
 * Provides CRUD operations and query building for entities
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
     * Take a specific number of records
     */
    public take(count: number): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).take(count);
    }

    /**
     * Skip a specific number of records
     */
    public skip(count: number): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).skip(count);
    }

    /**
     * Get the first entity or null
     */
    public async firstOrDefault(): Promise<T | null> {
        const results = await this._provider.findAll(this._entityClass);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get the first entity or throw an error
     */
    public async first(): Promise<T> {
        const result = await this.firstOrDefault();
        if (result === null) {
            throw new Error('Sequence contains no elements');
        }
        return result;
    }

    /**
     * Check if any entities exist
     */
    public async any(): Promise<boolean> {
        const results = await this._provider.findAll(this._entityClass);
        return results.length > 0;
    }

    /**
     * Count the number of entities
     */
    public async count(): Promise<number> {
        return await this._provider.count(this._entityClass);
    }

    /**
     * Group by a field
     */
    public groupBy<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).groupBy(keySelector);
    }

    /**
     * Join with another entity set
     */
    public join<TInner, TKey, TResult>(
        inner: DbSet<TInner>,
        outerKeySelector: (outer: T) => TKey,
        innerKeySelector: (inner: TInner) => TKey,
        resultSelector?: (outer: T, inner: TInner) => TResult
    ): QueryBuilder<TResult> {
        const innerQuery = new QueryBuilder<TInner>(inner._entityClass, this._provider);
        return new QueryBuilder<T>(this._entityClass, this._provider)
            .join(innerQuery, outerKeySelector, innerKeySelector, resultSelector);
    }

    /**
     * Get distinct values
     */
    public distinct(): QueryBuilder<T> {
        return new QueryBuilder<T>(this._entityClass, this._provider).distinct();
    }

    /**
     * Get minimum value
     */
    public async min<TResult>(selector?: (entity: T) => TResult): Promise<TResult | null> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).min(selector);
    }

    /**
     * Get maximum value
     */
    public async max<TResult>(selector?: (entity: T) => TResult): Promise<TResult | null> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).max(selector);
    }

    /**
     * Get sum of values
     */
    public async sum<TResult>(selector: (entity: T) => TResult): Promise<number> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).sum(selector);
    }

    /**
     * Get average of values
     */
    public async average<TResult>(selector: (entity: T) => TResult): Promise<number> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).average(selector);
    }

    /**
     * Check if all elements satisfy a condition
     */
    public async all(predicate: (entity: T) => boolean): Promise<boolean> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).all(predicate);
    }

    /**
     * Check if the sequence contains a specific element
     */
    public async contains(entity: T): Promise<boolean> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).contains(entity);
    }

    /**
     * Single element or throw exception
     */
    public async single(): Promise<T> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).single();
    }

    /**
     * Single element or default
     */
    public async singleOrDefault(): Promise<T | null> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).singleOrDefault();
    }

    /**
     * Last element
     */
    public async last(): Promise<T> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).last();
    }

    /**
     * Last element or default
     */
    public async lastOrDefault(): Promise<T | null> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).lastOrDefault();
    }

    /**
     * Get elements at specific indices
     */
    public async elementAt(index: number): Promise<T | null> {
        return await new QueryBuilder<T>(this._entityClass, this._provider).elementAt(index);
    }
}



/**
 * DbSet with include functionality for eager loading
 * Similar to Entity Framework's Include method
 */
export class DbSetWithIncludes<T> {
    private _dbSet: DbSet<T>;
    private _includes: string[];
    private _entityLoader: EntityLoader;

    constructor(dbSet: DbSet<T>, includes: string[], entityLoader: EntityLoader) {
        this._dbSet = dbSet;
        this._includes = includes;
        this._entityLoader = entityLoader;
    }

    /**
     * Add more includes
     */
    public include(...includes: string[]): DbSetWithIncludes<T> {
        return new DbSetWithIncludes(
            this._dbSet,
            [...this._includes, ...includes],
            this._entityLoader
        );
    }

    /**
     * Execute the query with eager loading
     */
    public async toArray(): Promise<T[]> {
        const entities = await this._dbSet.toArray();

        // Apply eager loading to all entities
        for (const entity of entities) {
            await this._entityLoader.loadEntity(
                this._dbSet['_entityClass'],
                this.getPrimaryKeyValue(entity),
                {
                    strategy: LoadingStrategy.Eager,
                    includes: this._includes
                }
            );
        }

        return entities;
    }

    /**
     * Get first entity with includes
     */
    public async first(): Promise<T> {
        const entity = await this._dbSet.first();

        await this._entityLoader.loadEntity(
            this._dbSet['_entityClass'],
            this.getPrimaryKeyValue(entity),
            {
                strategy: LoadingStrategy.Eager,
                includes: this._includes
            }
        );

        return entity;
    }

    /**
     * Get first entity or default with includes
     */
    public async firstOrDefault(): Promise<T | null> {
        const entity = await this._dbSet.firstOrDefault();
        if (!entity) return null;

        await this._entityLoader.loadEntity(
            this._dbSet['_entityClass'],
            this.getPrimaryKeyValue(entity),
            {
                strategy: LoadingStrategy.Eager,
                includes: this._includes
            }
        );

        return entity;
    }

    /**
     * Apply where condition and maintain includes
     */
    public where(predicate: (entity: T) => boolean): QueryBuilderWithIncludes<T> {
        const queryBuilder = this._dbSet.where(predicate);
        return new QueryBuilderWithIncludes(queryBuilder, this._includes, this._entityLoader);
    }

    /**
     * Apply ordering and maintain includes
     */
    public orderBy<TKey>(keySelector: (entity: T) => TKey): QueryBuilderWithIncludes<T> {
        const queryBuilder = this._dbSet.orderBy(keySelector);
        return new QueryBuilderWithIncludes(queryBuilder, this._includes, this._entityLoader);
    }

    /**
     * Apply take and maintain includes
     */
    public take(count: number): QueryBuilderWithIncludes<T> {
        const queryBuilder = this._dbSet.take(count);
        return new QueryBuilderWithIncludes(queryBuilder, this._includes, this._entityLoader);
    }

    /**
     * Apply skip and maintain includes
     */
    public skip(count: number): QueryBuilderWithIncludes<T> {
        const queryBuilder = this._dbSet.skip(count);
        return new QueryBuilderWithIncludes(queryBuilder, this._includes, this._entityLoader);
    }

    /**
     * Get primary key value from entity (simplified)
     */
    private getPrimaryKeyValue(entity: T): any {
        // Simplified - assumes 'id' property
        return (entity as any).id;
    }
}

/**
 * QueryBuilder with include functionality
 */
export class QueryBuilderWithIncludes<T> {
    private _queryBuilder: QueryBuilder<T>;
    private _includes: string[];
    private _entityLoader: EntityLoader;

    constructor(queryBuilder: QueryBuilder<T>, includes: string[], entityLoader: EntityLoader) {
        this._queryBuilder = queryBuilder;
        this._includes = includes;
        this._entityLoader = entityLoader;
    }

    /**
     * Add where condition
     */
    public where(predicate: (entity: T) => boolean): QueryBuilderWithIncludes<T> {
        return new QueryBuilderWithIncludes(
            this._queryBuilder.where(predicate),
            this._includes,
            this._entityLoader
        );
    }

    /**
     * Add ordering
     */
    public orderBy<TKey>(keySelector: (entity: T) => TKey): QueryBuilderWithIncludes<T> {
        return new QueryBuilderWithIncludes(
            this._queryBuilder.orderBy(keySelector),
            this._includes,
            this._entityLoader
        );
    }

    /**
     * Add ordering descending
     */
    public orderByDescending<TKey>(keySelector: (entity: T) => TKey): QueryBuilderWithIncludes<T> {
        return new QueryBuilderWithIncludes(
            this._queryBuilder.orderByDescending(keySelector),
            this._includes,
            this._entityLoader
        );
    }

    /**
     * Take records
     */
    public take(count: number): QueryBuilderWithIncludes<T> {
        return new QueryBuilderWithIncludes(
            this._queryBuilder.take(count),
            this._includes,
            this._entityLoader
        );
    }

    /**
     * Skip records
     */
    public skip(count: number): QueryBuilderWithIncludes<T> {
        return new QueryBuilderWithIncludes(
            this._queryBuilder.skip(count),
            this._includes,
            this._entityLoader
        );
    }

    /**
     * Execute query with eager loading
     */
    public async toArray(): Promise<T[]> {
        const entities = await this._queryBuilder.toArray();

        // Apply eager loading to all entities
        for (const entity of entities) {
            await this._entityLoader.loadEntity(
                this._queryBuilder['_entityClass'],
                this.getPrimaryKeyValue(entity),
                {
                    strategy: LoadingStrategy.Eager,
                    includes: this._includes
                }
            );
        }

        return entities;
    }

    /**
     * Get first entity with includes
     */
    public async first(): Promise<T> {
        const entity = await this._queryBuilder.first();

        await this._entityLoader.loadEntity(
            this._queryBuilder['_entityClass'],
            this.getPrimaryKeyValue(entity),
            {
                strategy: LoadingStrategy.Eager,
                includes: this._includes
            }
        );

        return entity;
    }

    /**
     * Get first entity or default with includes
     */
    public async firstOrDefault(): Promise<T | null> {
        const entity = await this._queryBuilder.firstOrDefault();
        if (!entity) return null;

        await this._entityLoader.loadEntity(
            this._queryBuilder['_entityClass'],
            this.getPrimaryKeyValue(entity),
            {
                strategy: LoadingStrategy.Eager,
                includes: this._includes
            }
        );

        return entity;
    }

    /**
     * Get primary key value from entity (simplified)
     */
    private getPrimaryKeyValue(entity: T): any {
        return (entity as any).id;
    }
}



/**
 * Lazy loader for handling deferred loading of related entities
 * Similar to Entity Framework's lazy loading proxies
 */
export class LazyLoader<T> {
    private _loaded: boolean = false;
    private _value: T | null = null;
    private _loadFunction: () => Promise<T>;

    constructor(loadFunction: () => Promise<T>) {
        this._loadFunction = loadFunction;
    }

    /**
     * Get the value, loading it if necessary
     */
    public async getValue(): Promise<T | null> {
        if (!this._loaded) {
            try {
                this._value = await this._loadFunction();
                this._loaded = true;
            } catch (error) {
                console.error('Failed to lazy load entity:', error);
                this._value = null;
                this._loaded = true;
            }
        }
        return this._value;
    }

    /**
     * Check if the value has been loaded
     */
    public get isLoaded(): boolean {
        return this._loaded;
    }

    /**
     * Get the value synchronously (only if already loaded)
     */
    public get value(): T | null {
        return this._loaded ? this._value : null;
    }

    /**
     * Reset the loader to unloaded state
     */
    public reset(): void {
        this._loaded = false;
        this._value = null;
    }
}

/**
 * Lazy collection loader for one-to-many relationships
 */
export class LazyCollection<T> {
    private _loaded: boolean = false;
    private _items: T[] = [];
    private _loadFunction: () => Promise<T[]>;

    constructor(loadFunction: () => Promise<T[]>) {
        this._loadFunction = loadFunction;
    }

    /**
     * Get all items, loading them if necessary
     */
    public async getItems(): Promise<T[]> {
        if (!this._loaded) {
            try {
                this._items = await this._loadFunction();
                this._loaded = true;
            } catch (error) {
                console.error('Failed to lazy load collection:', error);
                this._items = [];
                this._loaded = true;
            }
        }
        return this._items;
    }

    /**
     * Get the count of items (loads if necessary)
     */
    public async count(): Promise<number> {
        const items = await this.getItems();
        return items.length;
    }

    /**
     * Check if the collection has been loaded
     */
    public get isLoaded(): boolean {
        return this._loaded;
    }

    /**
     * Get items synchronously (only if already loaded)
     */
    public get items(): T[] {
        return this._loaded ? this._items : [];
    }

    /**
     * Add an item to the collection
     */
    public add(item: T): void {
        if (this._loaded) {
            this._items.push(item);
        }
    }

    /**
     * Remove an item from the collection
     */
    public remove(item: T): boolean {
        if (this._loaded) {
            const index = this._items.indexOf(item);
            if (index !== -1) {
                this._items.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * Reset the collection to unloaded state
     */
    public reset(): void {
        this._loaded = false;
        this._items = [];
    }
}

/**
 * Loading strategy enumeration
 */
export enum LoadingStrategy {
    Lazy = 'lazy',
    Eager = 'eager',
    Explicit = 'explicit'
}

/**
 * Options for configuring loading behavior
 */
export interface LoadingOptions {
    strategy: LoadingStrategy;
    includes?: string[];
    depth?: number;
}

/**
 * Entity loader for managing loading strategies
 */
export class EntityLoader {
    private _provider: DatabaseProvider;
    private _defaultStrategy: LoadingStrategy = LoadingStrategy.Lazy;

    constructor(provider: DatabaseProvider) {
        this._provider = provider;
    }

    /**
     * Set the default loading strategy
     */
    public setDefaultStrategy(strategy: LoadingStrategy): void {
        this._defaultStrategy = strategy;
    }

    /**
     * Load an entity with its related data based on strategy
     */
    public async loadEntity<T>(
        entityClass: new () => T,
        id: any,
        options: LoadingOptions = { strategy: this._defaultStrategy }
    ): Promise<T | null> {
        const entity = await this._provider.findById(id, entityClass);
        if (!entity) {
            return null;
        }

        if (options.strategy === LoadingStrategy.Eager) {
            await this.eagerLoadRelations(entity, entityClass, options);
        } else if (options.strategy === LoadingStrategy.Lazy) {
            this.setupLazyLoading(entity, entityClass);
        }

        return entity;
    }

    /**
     * Load entities with their related data
     */
    public async loadEntities<T>(
        entityClass: new () => T,
        options: LoadingOptions = { strategy: this._defaultStrategy }
    ): Promise<T[]> {
        const entities = await this._provider.findAll(entityClass);

        if (options.strategy === LoadingStrategy.Eager) {
            for (const entity of entities) {
                await this.eagerLoadRelations(entity, entityClass, options);
            }
        } else if (options.strategy === LoadingStrategy.Lazy) {
            for (const entity of entities) {
                this.setupLazyLoading(entity, entityClass);
            }
        }

        return entities;
    }

    /**
     * Eagerly load all specified relations
     */
    private async eagerLoadRelations<T>(
        entity: T,
        entityClass: new () => T,
        options: LoadingOptions,
        currentDepth: number = 0
    ): Promise<void> {
        const maxDepth = options.depth || 3;
        if (currentDepth >= maxDepth) {
            return;
        }

        const relationships = MetadataStorage.getRelationshipsForEntity(entityClass);

        for (const relationship of relationships) {
            const shouldInclude = !options.includes ||
                options.includes.includes(relationship.propertyName);

            if (!shouldInclude) {
                continue;
            }

            if (relationship.type === 'many-to-one') {
                await this.loadManyToOneRelation(entity, relationship, options, currentDepth + 1);
            } else if (relationship.type === 'one-to-many') {
                await this.loadOneToManyRelation(entity, relationship, options, currentDepth + 1);
            }
        }
    }

    /**
     * Load a many-to-one relationship eagerly
     */
    private async loadManyToOneRelation<T>(
        entity: T,
        relationship: any,
        options: LoadingOptions,
        depth: number
    ): Promise<void> {
        const foreignKeyValue = (entity as any)[relationship.foreignKey || (relationship.propertyName + 'Id')];
        if (foreignKeyValue) {
            const relatedEntityClass = relationship.relatedEntity();
            const relatedEntity = await this._provider.findById(foreignKeyValue, relatedEntityClass);

            if (relatedEntity) {
                (entity as any)[relationship.propertyName] = relatedEntity;
                await this.eagerLoadRelations(relatedEntity, relatedEntityClass, options, depth);
            }
        }
    }

    /**
     * Load a one-to-many relationship eagerly
     */
    private async loadOneToManyRelation<T>(
        entity: T,
        relationship: any,
        options: LoadingOptions,
        depth: number
    ): Promise<void> {
        const entityMetadata = MetadataStorage.getEntityMetadata((entity as any).constructor);
        const primaryKeys = MetadataStorage.getPrimaryKeysForEntity((entity as any).constructor);

        if (primaryKeys.length > 0) {
            const primaryKeyValue = (entity as any)[primaryKeys[0].propertyName];
            const relatedEntityClass = relationship.relatedEntity();

            // This is a simplified approach - in production would need proper foreign key handling
            const relatedEntities = await this._provider.findAll(relatedEntityClass);
            const filteredEntities = relatedEntities.filter((relatedEntity: any) => {
                const foreignKey = relationship.mappedBy || (entityMetadata.tableName.slice(0, -1) + 'Id');
                return relatedEntity[foreignKey] === primaryKeyValue;
            });

            (entity as any)[relationship.propertyName] = filteredEntities;

            for (const relatedEntity of filteredEntities) {
                await this.eagerLoadRelations(relatedEntity, relatedEntityClass, options, depth);
            }
        }
    }

    /**
     * Setup lazy loading proxies for all navigation properties
     */
    private setupLazyLoading<T>(entity: T, entityClass: new () => T): void {
        const relationships = MetadataStorage.getRelationshipsForEntity(entityClass);

        for (const relationship of relationships) {
            if (relationship.type === 'many-to-one') {
                this.setupLazyManyToOne(entity, relationship);
            } else if (relationship.type === 'one-to-many') {
                this.setupLazyOneToMany(entity, relationship);
            }
        }
    }

    /**
     * Setup lazy loading for a many-to-one relationship
     */
    private setupLazyManyToOne<T>(entity: T, relationship: any): void {
        const loader = new LazyLoader<any>(async () => {
            const foreignKeyValue = (entity as any)[relationship.foreignKey || (relationship.propertyName + 'Id')];
            if (foreignKeyValue) {
                const relatedEntityClass = relationship.relatedEntity();
                return await this._provider.findById(foreignKeyValue, relatedEntityClass);
            }
            return null;
        });

        // Create property getter that triggers lazy loading
        Object.defineProperty(entity, relationship.propertyName, {
            get: () => loader.getValue(),
            enumerable: true,
            configurable: true
        });

        // Store loader reference for advanced scenarios
        Object.defineProperty(entity, `_${relationship.propertyName}Loader`, {
            value: loader,
            writable: false,
            enumerable: false,
            configurable: false
        });
    }

    /**
     * Setup lazy loading for a one-to-many relationship
     */
    private setupLazyOneToMany<T>(entity: T, relationship: any): void {
        const collection = new LazyCollection<any>(async () => {
            const entityMetadata = MetadataStorage.getEntityMetadata((entity as any).constructor);
            const primaryKeys = MetadataStorage.getPrimaryKeysForEntity((entity as any).constructor);

            if (primaryKeys.length > 0) {
                const primaryKeyValue = (entity as any)[primaryKeys[0].propertyName];
                const relatedEntityClass = relationship.relatedEntity();

                const relatedEntities = await this._provider.findAll(relatedEntityClass);
                const foreignKey = relationship.mappedBy || (entityMetadata.tableName.slice(0, -1) + 'Id');
                return relatedEntities.filter((relatedEntity: any) =>
                    relatedEntity[foreignKey] === primaryKeyValue
                );
            }
            return [];
        });

        // Create property getter that returns the lazy collection
        Object.defineProperty(entity, relationship.propertyName, {
            get: () => collection,
            enumerable: true,
            configurable: true
        });
    }
}


/**
 * QueryBuilder class for building LINQ-like queries
 * Similar to Entity Framework's IQueryable<T>
 */
export class QueryBuilder<T> {
    private _entityClass: new () => T;
    private _provider: DatabaseProvider;
    private _whereConditions: string[] = [];
    private _selectFields: string[] = [];
    private _orderByFields: { field: string; direction: 'ASC' | 'DESC' }[] = [];
    private _limitCount?: number;
    private _offsetCount?: number;
    private _parameters: any[] = [];

    constructor(entityClass: new () => T, provider: DatabaseProvider) {
        this._entityClass = entityClass;
        this._provider = provider;
    }

    /**
     * Add a where condition
     */
    public where(predicate: (entity: T) => boolean): QueryBuilder<T> {
        // Convert function to SQL - this is a simplified implementation
        // In a real implementation, you would parse the function AST
        const functionString = predicate.toString();
        const condition = this.parseWhereCondition(functionString);
        this._whereConditions.push(condition);
        return this;
    }

    /**
     * Select specific fields
     */
    public select<TResult>(selector: (entity: T) => TResult): QueryBuilder<TResult> {
        const functionString = selector.toString();
        const fields = this.parseSelectFields(functionString);
        this._selectFields = fields;
        return this as any;
    }

    /**
     * Order by a field ascending
     */
    public orderBy<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        const functionString = keySelector.toString();
        const field = this.parseFieldName(functionString);
        this._orderByFields.push({ field, direction: 'ASC' });
        return this;
    }

    /**
     * Order by a field descending
     */
    public orderByDescending<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        const functionString = keySelector.toString();
        const field = this.parseFieldName(functionString);
        this._orderByFields.push({ field, direction: 'DESC' });
        return this;
    }

    /**
     * Limit the number of results
     */
    public take(count: number): QueryBuilder<T> {
        this._limitCount = count;
        return this;
    }

    /**
     * Skip a number of results
     */
    public skip(count: number): QueryBuilder<T> {
        this._offsetCount = count;
        return this;
    }

    /**
     * Execute the query and return results
     */
    public async toArray(): Promise<T[]> {
        const sql = this.buildSql();
        return await this._provider.executeQuery(sql, this._parameters, this._entityClass);
    }

    /**
     * Execute the query and return the first result
     */
    public async firstOrDefault(): Promise<T | null> {
        this._limitCount = 1;
        const results = await this.toArray();
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Execute the query and return the first result or throw
     */
    public async first(): Promise<T> {
        const result = await this.firstOrDefault();
        if (result === null) {
            throw new Error('Sequence contains no elements');
        }
        return result;
    }

    /**
     * Check if any results exist
     */
    public async any(): Promise<boolean> {
        this._limitCount = 1;
        this._selectFields = ['1'];
        const results = await this.toArray();
        return results.length > 0;
    }

    /**
     * Count the results
     */
    public async count(): Promise<number> {
        this._selectFields = ['COUNT(*)'];
        const results = await this._provider.executeQuery(
            this.buildSql(),
            this._parameters,
            this._entityClass
        );
        return results.length > 0 ? Object.values(results[0])[0] as number : 0;
    }

    /**
     * Join with another entity
     */
    public join<TInner, TKey, TResult>(
        inner: QueryBuilder<TInner>,
        outerKeySelector: (outer: T) => TKey,
        innerKeySelector: (inner: TInner) => TKey,
        resultSelector?: (outer: T, inner: TInner) => TResult
    ): QueryBuilder<TResult> {
        // This is a simplified implementation - in production would need proper SQL generation
        const outerField = this.parseFieldName(outerKeySelector.toString());
        const innerField = this.parseFieldName(innerKeySelector.toString());

        // Store join information for SQL generation
        (this as any)._joins = (this as any)._joins || [];
        (this as any)._joins.push({
            type: 'INNER',
            table: inner._entityClass.name.toLowerCase(),
            condition: `${outerField} = ${innerField}`,
            resultSelector: resultSelector
        });

        return this as any;
    }

    /**
     * Left join with another entity
     */
    public leftJoin<TInner, TKey, TResult>(
        inner: QueryBuilder<TInner>,
        outerKeySelector: (outer: T) => TKey,
        innerKeySelector: (inner: TInner) => TKey,
        resultSelector?: (outer: T, inner: TInner) => TResult
    ): QueryBuilder<TResult> {
        const outerField = this.parseFieldName(outerKeySelector.toString());
        const innerField = this.parseFieldName(innerKeySelector.toString());

        (this as any)._joins = (this as any)._joins || [];
        (this as any)._joins.push({
            type: 'LEFT',
            table: inner._entityClass.name.toLowerCase(),
            condition: `${outerField} = ${innerField}`,
            resultSelector: resultSelector
        });

        return this as any;
    }

    /**
     * Group by a field
     */
    public groupBy<TKey>(keySelector: (entity: T) => TKey): QueryBuilder<T> {
        const field = this.parseFieldName(keySelector.toString());
        (this as any)._groupByFields = (this as any)._groupByFields || [];
        (this as any)._groupByFields.push(field);
        return this;
    }

    /**
     * Having clause for grouped queries
     */
    public having(predicate: (entity: T) => boolean): QueryBuilder<T> {
        const condition = this.parseWhereCondition(predicate.toString());
        (this as any)._havingConditions = (this as any)._havingConditions || [];
        (this as any)._havingConditions.push(condition);
        return this;
    }

    /**
     * Distinct values
     */
    public distinct(): QueryBuilder<T> {
        (this as any)._distinct = true;
        return this;
    }

    /**
     * Union with another query
     */
    public union(other: QueryBuilder<T>): QueryBuilder<T> {
        (this as any)._unions = (this as any)._unions || [];
        (this as any)._unions.push({ type: 'UNION', query: other });
        return this;
    }

    /**
     * Union all with another query
     */
    public unionAll(other: QueryBuilder<T>): QueryBuilder<T> {
        (this as any)._unions = (this as any)._unions || [];
        (this as any)._unions.push({ type: 'UNION ALL', query: other });
        return this;
    }

    /**
     * Intersect with another query
     */
    public intersect(other: QueryBuilder<T>): QueryBuilder<T> {
        (this as any)._intersects = (this as any)._intersects || [];
        (this as any)._intersects.push(other);
        return this;
    }

    /**
     * Except (minus) another query
     */
    public except(other: QueryBuilder<T>): QueryBuilder<T> {
        (this as any)._excepts = (this as any)._excepts || [];
        (this as any)._excepts.push(other);
        return this;
    }

    /**
     * Check if all elements satisfy a condition
     */
    public async all(predicate: (entity: T) => boolean): Promise<boolean> {
        const negatedCondition = this.negateCondition(predicate.toString());
        const query = new QueryBuilder<T>(this._entityClass, this._provider);
        query._whereConditions = [...this._whereConditions, negatedCondition];
        query._parameters = [...this._parameters];

        const count = await query.count();
        return count === 0;
    }

    /**
     * Get the minimum value
     */
    public async min<TResult>(selector?: (entity: T) => TResult): Promise<TResult | null> {
        const field = selector ? this.parseFieldName(selector.toString()) : '*';
        this._selectFields = [`MIN(${field})`];
        const results = await this._provider.executeQuery(
            this.buildSql(),
            this._parameters,
            this._entityClass
        );
        return results.length > 0 ? Object.values(results[0])[0] as TResult : null;
    }

    /**
     * Get the maximum value
     */
    public async max<TResult>(selector?: (entity: T) => TResult): Promise<TResult | null> {
        const field = selector ? this.parseFieldName(selector.toString()) : '*';
        this._selectFields = [`MAX(${field})`];
        const results = await this._provider.executeQuery(
            this.buildSql(),
            this._parameters,
            this._entityClass
        );
        return results.length > 0 ? Object.values(results[0])[0] as TResult : null;
    }

    /**
     * Get the sum of values
     */
    public async sum<TResult>(selector: (entity: T) => TResult): Promise<number> {
        const field = this.parseFieldName(selector.toString());
        this._selectFields = [`SUM(${field})`];
        const results = await this._provider.executeQuery(
            this.buildSql(),
            this._parameters,
            this._entityClass
        );
        return results.length > 0 ? (Object.values(results[0])[0] as number) || 0 : 0;
    }

    /**
     * Get the average of values
     */
    public async average<TResult>(selector: (entity: T) => TResult): Promise<number> {
        const field = this.parseFieldName(selector.toString());
        this._selectFields = [`AVG(${field})`];
        const results = await this._provider.executeQuery(
            this.buildSql(),
            this._parameters,
            this._entityClass
        );
        return results.length > 0 ? (Object.values(results[0])[0] as number) || 0 : 0;
    }

    /**
     * Check if the sequence contains a specific element
     */
    public async contains(entity: T): Promise<boolean> {
        // This is a simplified implementation
        const results = await this.toArray();
        return results.some(item => JSON.stringify(item) === JSON.stringify(entity));
    }

    /**
     * Get elements at specific indices
     */
    public async elementAt(index: number): Promise<T | null> {
        const results = await this.skip(index).take(1).toArray();
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Single element or throw exception
     */
    public async single(): Promise<T> {
        const results = await this.take(2).toArray();
        if (results.length === 0) {
            throw new Error('Sequence contains no elements');
        }
        if (results.length > 1) {
            throw new Error('Sequence contains more than one element');
        }
        return results[0];
    }

    /**
     * Single element or default
     */
    public async singleOrDefault(): Promise<T | null> {
        const results = await this.take(2).toArray();
        if (results.length > 1) {
            throw new Error('Sequence contains more than one element');
        }
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Last element
     */
    public async last(): Promise<T> {
        // Reverse order and get first
        const results = await this.orderByDescending(() => 1 as any).take(1).toArray();
        if (results.length === 0) {
            throw new Error('Sequence contains no elements');
        }
        return results[0];
    }

    /**
     * Last element or default
     */
    public async lastOrDefault(): Promise<T | null> {
        const results = await this.orderByDescending(() => 1 as any).take(1).toArray();
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Build the SQL query
     */
    private buildSql(): string {
        const entityMetadata = MetadataStorage.getEntityMetadata(this._entityClass);
        const tableName = entityMetadata?.tableName || this._entityClass.name.toLowerCase();
        let sql = 'SELECT ';

        // DISTINCT clause
        if ((this as any)._distinct) {
            sql += 'DISTINCT ';
        }

        // SELECT clause
        if (this._selectFields.length > 0) {
            sql += this._selectFields.join(', ');
        } else {
            sql += '*';
        }

        sql += ` FROM ${tableName}`;

        // JOIN clauses
        const joins = (this as any)._joins || [];
        for (const join of joins) {
            sql += ` ${join.type} JOIN ${join.table} ON ${join.condition}`;
        }

        // WHERE clause
        if (this._whereConditions.length > 0) {
            sql += ' WHERE ' + this._whereConditions.join(' AND ');
        }

        // GROUP BY clause
        const groupByFields = (this as any)._groupByFields || [];
        if (groupByFields.length > 0) {
            sql += ' GROUP BY ' + groupByFields.join(', ');
        }

        // HAVING clause
        const havingConditions = (this as any)._havingConditions || [];
        if (havingConditions.length > 0) {
            sql += ' HAVING ' + havingConditions.join(' AND ');
        }

        // ORDER BY clause
        if (this._orderByFields.length > 0) {
            sql += ' ORDER BY ' + this._orderByFields
                .map(field => `${field.field} ${field.direction}`)
                .join(', ');
        }

        // LIMIT clause
        if (this._limitCount !== undefined) {
            sql += ` LIMIT ${this._limitCount}`;
        }

        // OFFSET clause
        if (this._offsetCount !== undefined) {
            sql += ` OFFSET ${this._offsetCount}`;
        }

        // UNION clauses
        const unions = (this as any)._unions || [];
        for (const union of unions) {
            sql += ` ${union.type} (${union.query.buildSql()})`;
        }

        // INTERSECT clauses (SQLite supports this)
        const intersects = (this as any)._intersects || [];
        for (const intersect of intersects) {
            sql += ` INTERSECT (${intersect.buildSql()})`;
        }

        // EXCEPT clauses (SQLite supports this)
        const excepts = (this as any)._excepts || [];
        for (const except of excepts) {
            sql += ` EXCEPT (${except.buildSql()})`;
        }

        return sql;
    }

    /**
     * Parse where condition from function string
     * This is a simplified implementation - real implementation would need proper AST parsing
     */
    private parseWhereCondition(functionString: string): string {
        // Simple regex-based parsing - in production, use a proper parser
        const match = functionString.match(/entity\.(\w+)\s*([><=!]+)\s*(.+)/);
        if (match) {
            const field = match[1];
            const operator = match[2];
            const value = match[3];

            // Convert value and add to parameters
            this._parameters.push(this.parseValue(value));
            return `${field} ${this.convertOperator(operator)} ?`;
        }

        return '1=1'; // fallback
    }

    /**
     * Parse select fields from function string
     */
    private parseSelectFields(functionString: string): string[] {
        // Simplified parsing
        const matches = functionString.match(/entity\.(\w+)/g);
        if (matches) {
            return matches.map(match => match.replace('entity.', ''));
        }
        return ['*'];
    }

    /**
     * Parse field name from function string
     */
    private parseFieldName(functionString: string): string {
        const match = functionString.match(/entity\.(\w+)/);
        return match ? match[1] : 'id';
    }

    /**
     * Convert JavaScript operators to SQL operators
     */
    private convertOperator(operator: string): string {
        switch (operator) {
            case '===':
            case '==':
                return '=';
            case '!==':
            case '!=':
                return '!=';
            case '>':
                return '>';
            case '<':
                return '<';
            case '>=':
                return '>=';
            case '<=':
                return '<=';
            default:
                return '=';
        }
    }

    /**
     * Parse value from string
     */
    private parseValue(value: string): any {
        value = value.trim();

        // String literal
        if (value.startsWith('"') || value.startsWith("'")) {
            return value.slice(1, -1);
        }

        // Number
        if (!isNaN(Number(value))) {
            return Number(value);
        }

        // Boolean
        if (value === 'true') return true;
        if (value === 'false') return false;

        return value;
    }

    /**
     * Negate a condition for the 'all' operator
     */
    private negateCondition(functionString: string): string {
        const condition = this.parseWhereCondition(functionString);
        // Simple negation - in production would need more sophisticated logic
        if (condition.includes('=')) {
            return condition.replace('=', '!=');
        }
        if (condition.includes('!=')) {
            return condition.replace('!=', '=');
        }
        if (condition.includes('>')) {
            return condition.replace('>', '<=');
        }
        if (condition.includes('<')) {
            return condition.replace('<', '>=');
        }
        return `NOT (${condition})`;
    }
}



export interface ColumnOptions {
    name?: string;
    type?: string;
    nullable?: boolean;
    length?: number;
    unique?: boolean;
    default?: any;
}

/**
 * Column decorator to mark a property as a database column
 * Similar to Entity Framework's [Column] attribute
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const type = Reflect.getMetadata('design:type', target, propertyKey);

        const columnMetadata = {
            target: target.constructor,
            propertyName: propertyKey as string,
            columnName: options.name || (propertyKey as string),
            type: options.type || getTypeFromReflection(type),
            nullable: options.nullable !== false,
            length: options.length,
            unique: options.unique || false,
            default: options.default
        };

        MetadataStorage.addColumn(columnMetadata);
    };
}

function getTypeFromReflection(type: any): string {
    if (type === String) return 'TEXT';
    if (type === Number) return 'INTEGER';
    if (type === Boolean) return 'BOOLEAN';
    if (type === Date) return 'DATETIME';
    return 'TEXT';
}



/**
 * Entity decorator to mark a class as a database entity
 * Similar to Entity Framework's [Table] attribute
 */
export function Entity(tableName?: string): ClassDecorator {
    return function (target: any) {
        const entityMetadata = {
            target: target,
            tableName: tableName || target.name.toLowerCase(),
            columns: [],
            primaryKeys: [],
            relationships: []
        };

        MetadataStorage.addEntity(entityMetadata);

        // Store metadata on the constructor
        Reflect.defineMetadata('entity:tableName', entityMetadata.tableName, target);
        Reflect.defineMetadata('entity:isEntity', true, target);
    };
}



export interface PrimaryKeyOptions {
    autoIncrement?: boolean;
}

/**
 * PrimaryKey decorator to mark a property as a primary key
 * Similar to Entity Framework's [Key] attribute
 */
export function PrimaryKey(options: PrimaryKeyOptions = {}): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const primaryKeyMetadata = {
            target: target.constructor,
            propertyName: propertyKey as string,
            autoIncrement: options.autoIncrement !== false
        };

        MetadataStorage.addPrimaryKey(primaryKeyMetadata);
    };
}


export interface OneToManyOptions {
    mappedBy?: string;
    cascade?: boolean;
}

export interface ManyToOneOptions {
    foreignKey?: string;
    cascade?: boolean;
}

/**
 * OneToMany decorator for one-to-many relationships
 * Similar to Entity Framework's navigation properties
 */
export function OneToMany(
    typeFunction: () => Function,
    options: OneToManyOptions = {}
): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const relationshipMetadata = {
            target: target.constructor,
            propertyName: propertyKey as string,
            type: 'one-to-many',
            relatedEntity: typeFunction,
            mappedBy: options.mappedBy,
            cascade: options.cascade || false
        };

        MetadataStorage.addRelationship(relationshipMetadata);
    };
}

/**
 * ManyToOne decorator for many-to-one relationships
 * Similar to Entity Framework's navigation properties
 */
export function ManyToOne(
    typeFunction: () => Function,
    options: ManyToOneOptions = {}
): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const relationshipMetadata = {
            target: target.constructor,
            propertyName: propertyKey as string,
            type: 'many-to-one',
            relatedEntity: typeFunction,
            foreignKey: options.foreignKey,
            cascade: options.cascade || false
        };

        MetadataStorage.addRelationship(relationshipMetadata);
    };
}


/**
 * Global metadata storage for entities, columns, and relationships
 * Similar to Entity Framework's model metadata system
 */
export class MetadataStorage {
    private static _entities: Map<Function, any> = new Map();
    private static _columns: Map<Function, any[]> = new Map();
    private static _primaryKeys: Map<Function, any[]> = new Map();
    private static _relationships: Map<Function, any[]> = new Map();

    /**
     * Add entity metadata
     */
    public static addEntity(entityMetadata: any): void {
        this._entities.set(entityMetadata.target, entityMetadata);
    }

    /**
     * Add column metadata
     */
    public static addColumn(columnMetadata: any): void {
        if (!this._columns.has(columnMetadata.target)) {
            this._columns.set(columnMetadata.target, []);
        }
        this._columns.get(columnMetadata.target)!.push(columnMetadata);
    }

    /**
     * Add primary key metadata
     */
    public static addPrimaryKey(primaryKeyMetadata: any): void {
        if (!this._primaryKeys.has(primaryKeyMetadata.target)) {
            this._primaryKeys.set(primaryKeyMetadata.target, []);
        }
        this._primaryKeys.get(primaryKeyMetadata.target)!.push(primaryKeyMetadata);
    }

    /**
     * Add relationship metadata
     */
    public static addRelationship(relationshipMetadata: any): void {
        if (!this._relationships.has(relationshipMetadata.target)) {
            this._relationships.set(relationshipMetadata.target, []);
        }
        this._relationships.get(relationshipMetadata.target)!.push(relationshipMetadata);
    }

    /**
     * Get all entities
     */
    public static getEntities(): any[] {
        return Array.from(this._entities.values());
    }

    /**
     * Get entity metadata by class
     */
    public static getEntityMetadata(entityClass: Function): any {
        return this._entities.get(entityClass);
    }

    /**
     * Get columns for an entity
     */
    public static getColumnsForEntity(entityClass: Function): any[] {
        return this._columns.get(entityClass) || [];
    }

    /**
     * Get primary keys for an entity
     */
    public static getPrimaryKeysForEntity(entityClass: Function): any[] {
        return this._primaryKeys.get(entityClass) || [];
    }

    /**
     * Get relationships for an entity
     */
    public static getRelationshipsForEntity(entityClass: Function): any[] {
        return this._relationships.get(entityClass) || [];
    }

    /**
     * Clear all metadata (useful for testing)
     */
    public static clear(): void {
        this._entities.clear();
        this._columns.clear();
        this._primaryKeys.clear();
        this._relationships.clear();
    }
}


/**
 * Base class for database migrations
 * Similar to Entity Framework's Migration class
 */
export abstract class Migration {
    public abstract up(): Promise<void>;
    public abstract down(): Promise<void>;
}

/**
 * Migration metadata
 */
export interface MigrationMetadata {
    name: string;
    timestamp: number;
    migration: new () => Migration;
}

/**
 * Migration runner for managing database schema changes
 */
export class MigrationRunner {
    private _migrations: MigrationMetadata[] = [];

    /**
     * Add a migration to the runner
     */
    public addMigration(name: string, migration: new () => Migration): void {
        this._migrations.push({
            name,
            timestamp: Date.now(),
            migration
        });
    }

    /**
     * Run all pending migrations
     */
    public async migrate(): Promise<void> {
        // Sort migrations by timestamp
        this._migrations.sort((a, b) => a.timestamp - b.timestamp);

        for (const migrationMetadata of this._migrations) {
            console.log(`Running migration: ${migrationMetadata.name}`);
            const migration = new migrationMetadata.migration();
            await migration.up();
            console.log(`Completed migration: ${migrationMetadata.name}`);
        }
    }

    /**
     * Rollback migrations
     */
    public async rollback(steps: number = 1): Promise<void> {
        // Sort migrations by timestamp descending
        this._migrations.sort((a, b) => b.timestamp - a.timestamp);

        for (let i = 0; i < steps && i < this._migrations.length; i++) {
            const migrationMetadata = this._migrations[i];
            console.log(`Rolling back migration: ${migrationMetadata.name}`);
            const migration = new migrationMetadata.migration();
            await migration.down();
            console.log(`Rolled back migration: ${migrationMetadata.name}`);
        }
    }
}


/**
 * Abstract base class for database providers
 * Similar to Entity Framework's database provider pattern
 */
export abstract class DatabaseProvider {
    protected connectionString: string;
    protected isConnected: boolean = false;

    constructor(connectionString: string) {
        this.connectionString = connectionString;
    }

    /**
     * Connect to the database
     */
    public abstract connect(): Promise<void>;

    /**
     * Disconnect from the database
     */
    public abstract disconnect(): Promise<void>;

    /**
     * Create a table for an entity
     */
    public abstract createTable(entityMetadata: any): Promise<void>;

    /**
     * Insert an entity
     */
    public abstract insert(entity: any, entityClass: Function): Promise<any>;

    /**
     * Update an entity
     */
    public abstract update(entity: any, entityClass: Function): Promise<void>;

    /**
     * Delete an entity
     */
    public abstract delete(entity: any, entityClass: Function): Promise<void>;

    /**
     * Find an entity by ID
     */
    public abstract findById(id: any, entityClass: Function): Promise<any>;

    /**
     * Find all entities of a type
     */
    public abstract findAll(entityClass: Function): Promise<any[]>;

    /**
     * Execute a raw SQL query
     */
    public abstract executeQuery(sql: string, parameters: any[], entityClass: Function): Promise<any[]>;

    /**
     * Count entities
     */
    public abstract count(entityClass: Function): Promise<number>;

    /**
     * Begin a transaction
     */
    public abstract beginTransaction(): Promise<void>;

    /**
     * Commit a transaction
     */
    public abstract commitTransaction(): Promise<void>;

    /**
     * Rollback a transaction
     */
    public abstract rollbackTransaction(): Promise<void>;
}


/**
 * SQLite database provider implementation
 */
export class SQLiteProvider extends DatabaseProvider {
    private _db?: sqlite3.Database;
    private _inTransaction: boolean = false;

    constructor(connectionString: string) {
        super(connectionString);
    }

    /**
     * Connect to the SQLite database
     */
    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._db = new sqlite3.Database(this.connectionString, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.isConnected = true;
                    resolve();
                }
            });
        });
    }

    /**
     * Disconnect from the database
     */
    public async disconnect(): Promise<void> {
        if (this._db) {
            return new Promise((resolve, reject) => {
                this._db!.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.isConnected = false;
                        resolve();
                    }
                });
            });
        }
    }

    /**
     * Create a table for an entity
     */
    public async createTable(entityMetadata: any): Promise<void> {
        const columns = MetadataStorage.getColumnsForEntity(entityMetadata.target);
        const primaryKeys = MetadataStorage.getPrimaryKeysForEntity(entityMetadata.target);

        let sql = `CREATE TABLE IF NOT EXISTS ${entityMetadata.tableName} (`;

        const columnDefinitions: string[] = [];

        for (const column of columns) {
            let columnDef = `${column.columnName} ${column.type}`;

            if (!column.nullable) {
                columnDef += ' NOT NULL';
            }

            if (column.unique) {
                columnDef += ' UNIQUE';
            }

            if (column.default !== undefined) {
                columnDef += ` DEFAULT ${column.default}`;
            }

            // Check if this column is a primary key
            const isPrimaryKey = primaryKeys.some(pk => pk.propertyName === column.propertyName);
            if (isPrimaryKey) {
                columnDef += ' PRIMARY KEY';
                const primaryKey = primaryKeys.find(pk => pk.propertyName === column.propertyName);
                if (primaryKey?.autoIncrement) {
                    columnDef += ' AUTOINCREMENT';
                }
            }

            columnDefinitions.push(columnDef);
        }

        sql += columnDefinitions.join(', ') + ')';

        await this.executeNonQuery(sql);
    }

    /**
     * Insert an entity
     */
    public async insert(entity: any, entityClass: Function): Promise<any> {
        const entityMetadata = MetadataStorage.getEntityMetadata(entityClass);
        const columns = MetadataStorage.getColumnsForEntity(entityClass);

        const columnNames = columns.map(col => col.columnName);
        const values = columns.map(col => entity[col.propertyName]);

        const placeholders = new Array(values.length).fill('?').join(', ');
        const sql = `INSERT INTO ${entityMetadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders})`;

        const result = await this.executeNonQuery(sql, values);

        // Set the auto-generated ID if applicable
        const primaryKeys = MetadataStorage.getPrimaryKeysForEntity(entityClass);
        const autoIncrementPK = primaryKeys.find(pk => pk.autoIncrement);
        if (autoIncrementPK && result.lastID) {
            entity[autoIncrementPK.propertyName] = result.lastID;
        }

        return entity;
    }

    /**
     * Update an entity
     */
    public async update(entity: any, entityClass: Function): Promise<void> {
        const entityMetadata = MetadataStorage.getEntityMetadata(entityClass);
        const columns = MetadataStorage.getColumnsForEntity(entityClass);
        const primaryKeys = MetadataStorage.getPrimaryKeysForEntity(entityClass);

        const setClause = columns
            .filter(col => !primaryKeys.some(pk => pk.propertyName === col.propertyName))
            .map(col => `${col.columnName} = ?`)
            .join(', ');

        const whereClause = primaryKeys
            .map(pk => {
                const column = columns.find(col => col.propertyName === pk.propertyName);
                return `${column?.columnName} = ?`;
            })
            .join(' AND ');

        const values = [
            ...columns
                .filter(col => !primaryKeys.some(pk => pk.propertyName === col.propertyName))
                .map(col => entity[col.propertyName]),
            ...primaryKeys.map(pk => entity[pk.propertyName])
        ];

        const sql = `UPDATE ${entityMetadata.tableName} SET ${setClause} WHERE ${whereClause}`;

        await this.executeNonQuery(sql, values);
    }

    /**
     * Delete an entity
     */
    public async delete(entity: any, entityClass: Function): Promise<void> {
        const entityMetadata = MetadataStorage.getEntityMetadata(entityClass);
        const columns = MetadataStorage.getColumnsForEntity(entityClass);
        const primaryKeys = MetadataStorage.getPrimaryKeysForEntity(entityClass);

        const whereClause = primaryKeys
            .map(pk => {
                const column = columns.find(col => col.propertyName === pk.propertyName);
                return `${column?.columnName} = ?`;
            })
            .join(' AND ');

        const values = primaryKeys.map(pk => entity[pk.propertyName]);

        const sql = `DELETE FROM ${entityMetadata.tableName} WHERE ${whereClause}`;

        await this.executeNonQuery(sql, values);
    }

    /**
     * Find an entity by ID
     */
    public async findById(id: any, entityClass: Function): Promise<any> {
        const entityMetadata = MetadataStorage.getEntityMetadata(entityClass);
        const columns = MetadataStorage.getColumnsForEntity(entityClass);
        const primaryKeys = MetadataStorage.getPrimaryKeysForEntity(entityClass);

        const primaryKey = primaryKeys[0]; // Assume single primary key for simplicity
        const column = columns.find(col => col.propertyName === primaryKey.propertyName);

        const sql = `SELECT * FROM ${entityMetadata.tableName} WHERE ${column?.columnName} = ?`;

        const rows = await this.executeQuery(sql, [id], entityClass);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find all entities of a type
     */
    public async findAll(entityClass: Function): Promise<any[]> {
        const entityMetadata = MetadataStorage.getEntityMetadata(entityClass);
        const sql = `SELECT * FROM ${entityMetadata.tableName}`;

        return await this.executeQuery(sql, [], entityClass);
    }

    /**
     * Execute a query and return mapped entities
     */
    public async executeQuery(sql: string, parameters: any[], entityClass: Function): Promise<any[]> {
        const rows = await this.executeRawQuery(sql, parameters);
        return rows.map(row => this.mapRowToEntity(row, entityClass));
    }

    /**
     * Count entities
     */
    public async count(entityClass: Function): Promise<number> {
        const entityMetadata = MetadataStorage.getEntityMetadata(entityClass);
        const sql = `SELECT COUNT(*) as count FROM ${entityMetadata.tableName}`;

        const rows = await this.executeRawQuery(sql, []);
        return rows.length > 0 ? rows[0].count : 0;
    }

    /**
     * Begin a transaction
     */
    public async beginTransaction(): Promise<void> {
        if (!this._inTransaction) {
            await this.executeNonQuery('BEGIN TRANSACTION');
            this._inTransaction = true;
        }
    }

    /**
     * Commit a transaction
     */
    public async commitTransaction(): Promise<void> {
        if (this._inTransaction) {
            await this.executeNonQuery('COMMIT');
            this._inTransaction = false;
        }
    }

    /**
     * Rollback a transaction
     */
    public async rollbackTransaction(): Promise<void> {
        if (this._inTransaction) {
            await this.executeNonQuery('ROLLBACK');
            this._inTransaction = false;
        }
    }

    /**
     * Execute a non-query SQL statement
     */
    private async executeNonQuery(sql: string, parameters: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this._db) {
                reject(new Error('Database not connected'));
                return;
            }

            this._db.run(sql, parameters, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Execute a raw query and return rows
     */
    private async executeRawQuery(sql: string, parameters: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if (!this._db) {
                reject(new Error('Database not connected'));
                return;
            }

            this._db.all(sql, parameters, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Map a database row to an entity instance
     */
    private mapRowToEntity(row: any, entityClass: Function): any {
        const entity = new (entityClass as any)();
        const columns = MetadataStorage.getColumnsForEntity(entityClass);

        for (const column of columns) {
            if (row.hasOwnProperty(column.columnName)) {
                entity[column.propertyName] = row[column.columnName];
            }
        }

        return entity;
    }
}


/**
 * Type definitions for the ORM framework
 */

export type Constructor<T = {}> = new (...args: any[]) => T;

export interface EntityMetadata {
    target: Function;
    tableName: string;
    columns: ColumnMetadata[];
    primaryKeys: PrimaryKeyMetadata[];
    relationships: RelationshipMetadata[];
}

export interface ColumnMetadata {
    target: Function;
    propertyName: string;
    columnName: string;
    type: string;
    nullable: boolean;
    length?: number;
    unique: boolean;
    default?: any;
}

export interface PrimaryKeyMetadata {
    target: Function;
    propertyName: string;
    autoIncrement: boolean;
}

export interface RelationshipMetadata {
    target: Function;
    propertyName: string;
    type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
    relatedEntity: () => Function;
    mappedBy?: string;
    foreignKey?: string;
    cascade: boolean;
}

export interface QueryOptions {
    select?: string[];
    where?: Record<string, any>;
    orderBy?: Record<string, 'ASC' | 'DESC'>;
    limit?: number;
    offset?: number;
}


export interface TrackedEntity {
    entity: any;
    entityClass: Function;
    state: EntityState;
    originalValues?: any;
}


/**
 * Utility functions for type handling and reflection
 */
export class TypeHelper {
    /**
     * Get the SQL type for a TypeScript type
     */
    public static getSqlType(jsType: any): string {
        if (jsType === String) return 'TEXT';
        if (jsType === Number) return 'INTEGER';
        if (jsType === Boolean) return 'BOOLEAN';
        if (jsType === Date) return 'DATETIME';
        return 'TEXT';
    }

    /**
     * Check if a value is a primitive type
     */
    public static isPrimitive(value: any): boolean {
        return value !== Object(value);
    }

    /**
     * Get the constructor name of an object
     */
    public static getConstructorName(obj: any): string {
        return obj.constructor.name;
    }

    /**
     * Deep clone an object
     */
    public static deepClone<T>(obj: T): T {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime()) as any;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item)) as any;
        }

        const clonedObj = {} as T;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = this.deepClone(obj[key]);
            }
        }

        return clonedObj;
    }

    /**
     * Check if two objects are equal
     */
    public static deepEqual(obj1: any, obj2: any): boolean {
        if (obj1 === obj2) {
            return true;
        }

        if (obj1 == null || obj2 == null) {
            return false;
        }

        if (typeof obj1 !== typeof obj2) {
            return false;
        }

        if (typeof obj1 !== 'object') {
            return obj1 === obj2;
        }

        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);

        if (keys1.length !== keys2.length) {
            return false;
        }

        for (const key of keys1) {
            if (!keys2.includes(key)) {
                return false;
            }

            if (!this.deepEqual(obj1[key], obj2[key])) {
                return false;
            }
        }

        return true;
    }
}
