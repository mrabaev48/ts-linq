import { LoadingStrategy, LoadingOptions } from './LoadingStrategy';
import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';

/**
 * Service responsible for loading entities with either lazy or eager strategy,
 * including recursive loading of relationships based on provided options.
 */
export class EntityLoader {
    private _provider: DatabaseProvider;
    private _defaultStrategy: LoadingStrategy = LoadingStrategy.Lazy;

    /**
     * @param provider Database provider used for underlying queries.
     */
    constructor(provider: DatabaseProvider) {
        this._provider = provider;
    }

    /**
     * Set the default loading strategy for operations.
     */
    public setDefaultStrategy(strategy: LoadingStrategy): void {
        this._defaultStrategy = strategy;
    }

    /**
     * Load a single entity by id with optional eager includes.
     */
    public async loadEntity<T>(
        entityClass: new () => T,
        id: any,
        options?: LoadingOptions
    ): Promise<T | null> {
        const entity = await this._provider.findById(id, entityClass);
        if (!entity) return null;

        const loadingOptions = {
            strategy: this._defaultStrategy,
            ...options
        };

        if (loadingOptions.strategy === LoadingStrategy.Eager || loadingOptions.includes) {
            await this.loadRelationships(entity, entityClass, loadingOptions);
        }

        return entity;
    }

    /**
     * Load all entities for a given type with optional eager includes.
     */
    public async loadEntities<T>(
        entityClass: new () => T,
        options?: LoadingOptions
    ): Promise<T[]> {
        const entities = await this._provider.findAll(entityClass);

        const loadingOptions = {
            strategy: this._defaultStrategy,
            ...options
        };

        if (loadingOptions.strategy === LoadingStrategy.Eager || loadingOptions.includes) {
            for (const entity of entities) {
                await this.loadRelationships(entity, entityClass, loadingOptions);
            }
        }

        return entities;
    }

    /**
     * Populate relationship properties on an entity according to options.
     */
    private async loadRelationships<T>(
        entity: T,
        entityClass: new () => T,
        options: LoadingOptions
    ): Promise<void> {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) return;

        const depth = options.depth || 1;
        if (depth <= 0) return;

        for (const relationship of metadata.relationships) {
            const shouldInclude = !options.includes || options.includes.includes(relationship.propertyName);
            if (!shouldInclude) continue;

            const foreignKey = relationship.foreignKey || `${relationship.targetEntity.name.toLowerCase()}Id`;
            const foreignKeyValue = (entity as any)[foreignKey];

            if (!foreignKeyValue) continue;

            try {
                switch (relationship.type) {
                    case 'many-to-one':
                    case 'one-to-one':
                        const relatedEntity = await this.loadEntity(
                            relationship.targetEntity as new () => any,
                            foreignKeyValue,
                            { ...options, depth: depth - 1 }
                        );
                        if (relatedEntity) {
                            (entity as any)[relationship.propertyName] = relatedEntity;
                        }
                        break;

                    case 'one-to-many':
                        const relatedEntities = await this._provider.findWhere(
                            relationship.targetEntity as new () => any,
                            { [foreignKey]: foreignKeyValue }
                        );
                        (entity as any)[relationship.propertyName] = relatedEntities;
                        break;
                }
            } catch (error) {
                console.warn(`Failed to load relationship ${relationship.propertyName}:`, error);
            }
        }
    }
}

export class DbSetWithIncludes<T> {
    private _dbSet: any;
    private _includes: string[];
    private _entityLoader: EntityLoader;

    /**
     * Wrapper over `DbSet` that forces eager loading of specified includes.
     */
    constructor(dbSet: any, includes: string[], entityLoader: EntityLoader) {
        this._dbSet = dbSet;
        this._includes = includes;
        this._entityLoader = entityLoader;
    }

    /** Return all entities with includes applied (eager). */
    public async toArray(): Promise<T[]> {
        return await this._entityLoader.loadEntities(
            this._dbSet._entityClass,
            { includes: this._includes, strategy: LoadingStrategy.Eager }
        );
    }

    /** Find one entity by id with includes applied (eager). */
    public async find(id: any): Promise<T | null> {
        return await this._entityLoader.loadEntity(
            this._dbSet._entityClass,
            id,
            { includes: this._includes, strategy: LoadingStrategy.Eager }
        );
    }

    /** Start a filtered query using the underlying `DbSet`. */
    public where(predicate: (entity: T) => boolean): any {
        return this._dbSet.where(predicate);
    }
}
