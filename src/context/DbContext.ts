import { DatabaseProvider } from '../providers/DatabaseProvider';
import { SQLiteProvider } from '../providers/SQLiteProvider';
import { ChangeTracker } from '../change-tracking/ChangeTracker';
import { EntityLoader, DbSetWithIncludes } from '../loading/EntityLoader';
import { LoadingStrategy, LoadingOptions } from '../loading/LoadingStrategy';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { DbSet } from './DbSet';
import { DbContextOptions } from '../types';

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
            const dbSet = new DbSet<any>(entity.target as new () => any, this._provider, this._changeTracker, this._entityLoader);
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
