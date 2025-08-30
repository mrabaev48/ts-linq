import { DatabaseProvider } from '../providers/DatabaseProvider';
import { SQLiteProvider } from '../providers/SQLiteProvider';
import { PostgresProvider } from '../providers/PostgresProvider';
import { ChangeTracker } from '../change-tracking/ChangeTracker';
import { MssqlProvider } from '../providers/MssqlProvider';
import { EntityLoader } from '../loading/EntityLoader';
import { LoadingStrategy, LoadingOptions } from '../loading/LoadingStrategy';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { DbSet } from './DbSet';
import { DbContextOptions, PerformanceOptions, Result, ok, err, LoadingDefaults } from '../types';
import { EntityCache } from '../utils/EntityCache';

/**
 * Base unit-of-work style context that orchestrates entity sets, change tracking
 * and database provider interactions. Similar to Entity Framework's `DbContext`.
 *
 * Note about auto-generated DbSet properties:
 * - For each registered entity class `User`, a property is created on the context instance
 *   using a simple pluralization of the lowercased class name:
 *   `<ClassName>.toLowerCase() + 's'`, with a basic `y → ies` rule.
 *   Examples: `Author` → `authors`, `Book` → `books`, `Category` → `categories`.
 * - If you want a different property name, either add your own getter that returns `set(YourEntity)`,
 *   or use `set(YourEntity)` directly instead of the auto-generated property.
 */
export abstract class DbContext {
    private _provider: DatabaseProvider;
    private _changeTracker: ChangeTracker;
    private _entityLoader: EntityLoader;
    private _dbSets: Map<Function, DbSet<any>> = new Map();
    private _defaultLoadingStrategy: LoadingStrategy = LoadingStrategy.Lazy;
    private _entityCache?: EntityCache;
    private _performanceOptions?: PerformanceOptions;
    private _loadingDefaults: LoadingDefaults = {};

    /**
     * Create a new database context instance.
     *
     * @param options Connection and provider configuration.
     */
    constructor(options: DbContextOptions) {
        // Initialize database provider based on options
        switch (options.provider || 'sqlite') {
            case 'sqlite':
                this._provider = new SQLiteProvider(options.connectionString, options.logger);
                break;
            case 'postgresql':
                this._provider = new PostgresProvider(options.connectionString, options.logger);
                break;
            case 'mssql':
                this._provider = new MssqlProvider(options.connectionString, options.logger);
                break;
            default:
                throw new Error(`Provider ${options.provider} is not supported`);
        }

        this._changeTracker = new ChangeTracker();
        this._entityLoader = new EntityLoader(this._provider);
        // Initialize optional L2 entity cache
        if (options.performance?.enableEntityCache) {
            this._entityCache = new EntityCache(options.performance.entityCacheSize ?? 10000);
        }
        // Store performance options for downstream consumers
        this._performanceOptions = options.performance;
        this._loadingDefaults = options.loading || {};
        this.initializeDbSets();
    }

    /**
     * Get a DbSet for the specified entity type
     *
     * @param entityClass Constructor of the entity type.
     * @returns Configured `DbSet` instance.
     */
    public set<T>(entityClass: new () => T): DbSet<T> {
        const normalized = (Reflect as any).getOwnMetadata?.('orm:original', entityClass) || entityClass;
        if (!this._dbSets.has(normalized)) {
            throw new Error(`DbSet for ${entityClass.name} is not configured`);
        }
        const dbSet = this._dbSets.get(normalized) as DbSet<T>;
        // Ensure the DbSet reflects the exact (possibly decorated) class passed in
        (dbSet as any)._entityClass = entityClass;
        return dbSet;
    }

    /**
     * Initialize the database and create tables
     *
     * Connects the provider and creates tables for all registered entities.
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
     *
     * @returns Number of affected rows.
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

    /** Try-версия saveChanges без исключений. */
    public async trySaveChanges(): Promise<Result<number, Error>> {
        try {
            const n = await this.saveChanges();
            return ok(n);
        } catch (e: any) {
            return err(e);
        }
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
     *
     * @returns The active `DatabaseProvider` implementation.
     */
    protected get provider(): DatabaseProvider {
        return this._provider;
    }

    /**
     * Get the change tracker
     *
     * @returns The `ChangeTracker` handling entity states.
     */
    protected get changeTracker(): ChangeTracker {
        return this._changeTracker;
    }

    /**
     * Get the entity loader
     *
     * @returns The `EntityLoader` used for eager/lazy loading.
     */
    protected get entityLoader(): EntityLoader {
        return this._entityLoader;
    }

    /**
     * Set the default loading strategy
     *
     * @param strategy Loading strategy to use by default.
     */
    public setLoadingStrategy(strategy: LoadingStrategy): void {
        this._defaultLoadingStrategy = strategy;
        this._entityLoader.setDefaultStrategy(strategy);
    }

    /**
     * Find an entity by ID with loading options
     *
     * @param entityClass Constructor of the entity type.
     * @param id Primary key value.
     * @param options Loading options (strategy, includes, depth).
     * @returns The found entity or null.
     */
    public async find<T>(
        entityClass: new () => T,
        id: any,
        options?: LoadingOptions
    ): Promise<T | null> {
        const loadingOptions = {
            strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
            depth: this._loadingDefaults.depth ?? options?.depth,
            ...(options || {})
        };
        return await this._entityLoader.loadEntity(entityClass, id, loadingOptions);
    }

    /**
     * Find entities with loading options
     *
     * @param entityClass Constructor of the entity type.
     * @param options Loading options (strategy, includes, depth).
     * @returns Array of loaded entities.
     */
    public async findAll<T>(
        entityClass: new () => T,
        options?: LoadingOptions
    ): Promise<T[]> {
        const loadingOptions = {
            strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
            depth: this._loadingDefaults.depth ?? options?.depth,
            ...(options || {})
        };
        return await this._entityLoader.loadEntities(entityClass, loadingOptions);
    }

    // Removed string-based include API in favor of predicate-based include on Queryable

    /**
     * Initialize DbSets for all registered entities.
     *
     * This method also defines auto-generated properties on the context instance
     * for each entity using a simple naming convention (see class JSDoc). If your
     * code expects different names, prefer `set(Entity)` or add your own proxy
     * getters that delegate to `set(Entity)`.
     */
    private initializeDbSets(): void {
        const entities = MetadataStorage.getEntities();

        for (const entity of entities) {
            const original = (Reflect as any).getOwnMetadata?.('orm:original', entity.target) || entity.target;
            const dbSet = new DbSet<any>(
                original as new () => any,
                this._provider,
                this._changeTracker,
                this._entityLoader,
                this._entityCache,
                this._performanceOptions
            );
            this._dbSets.set(original, dbSet);

            // Create property on context instance for easy access
            const base = original.name.toLowerCase();
            const propertyName = base.endsWith('y') ? base.slice(0, -1) + 'ies' : base + 's';
            Object.defineProperty(this, propertyName, {
                get: () => dbSet,
                enumerable: true,
                configurable: false
            });
        }
    }
}
