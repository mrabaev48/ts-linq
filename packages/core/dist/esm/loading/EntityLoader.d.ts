import type { LoadingOptions } from './LoadingStrategy';
import { LoadingStrategy } from './LoadingStrategy';
import type { DatabaseProvider } from '../DatabaseProvider';
/**
 * Service responsible for loading entities with either lazy or eager strategy,
 * including recursive loading of relationships based on provided options.
 */
export declare class EntityLoader {
    private _provider;
    private _defaultStrategy;
    /**
     * @param provider Database provider used for underlying queries.
     */
    constructor(provider: DatabaseProvider);
    /**
     * Set the default loading strategy for operations.
     */
    setDefaultStrategy(strategy: LoadingStrategy): void;
    /**
     * Load a single entity by id with optional eager includes or lazy loading.
     */
    loadEntity<T extends object>(entityClass: new () => T, id: unknown, options?: LoadingOptions): Promise<T | null>;
    /**
     * Load all entities for a given type with optional eager includes or lazy loading.
     */
    loadEntities<T extends object>(entityClass: new () => T, options?: LoadingOptions): Promise<T[]>;
    /**
     * Populate relationship properties on an entity according to options.
     */
    private loadRelationships;
    /** Batched variant to reduce N+1 queries when loading many entities. */
    private loadRelationshipsBatched;
    /**
     * Public helper to populate specified relationships on a single entity instance.
     * Useful for post-processing entities fetched by custom queries.
     */
    populateRelationships<T>(entity: T, entityClass: new () => T, options: LoadingOptions): Promise<void>;
    /**
     * Public helper to populate relationships for many entities in a batched way.
     * Reduces N+1 queries by grouping related fetches.
     */
    populateRelationshipsMany<T>(entities: T[], entityClass: new () => T, options: LoadingOptions): Promise<void>;
    /**
     * Resolve a relationship target that may be provided either as a constructor
     * or as a lazy callback returning the constructor.
     * @param target Constructor or thunk returning a constructor
     * @returns Concrete constructor function for the target entity
     */
    private resolveTargetEntity;
    /**
     * Compute a default foreign key name for a given type using the convention
     * camelCase(typeName) + 'Id', e.g., User -> userId.
     * @param type Target constructor
     * @returns Conventional foreign key column name
     */
    private defaultForeignKeyFor;
}
//# sourceMappingURL=EntityLoader.d.ts.map