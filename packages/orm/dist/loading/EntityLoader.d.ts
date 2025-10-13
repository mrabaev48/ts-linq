import type { LoadingOptions } from './LoadingStrategy';
import { LoadingStrategy } from './LoadingStrategy';
import type { DatabaseProvider } from '@ts-linq/core/dist/DatabaseProvider';
/**
 * Service responsible for loading entities with either lazy or eager strategy,
 * including recursive loading of relationships based on provided options.
 */
export declare class EntityLoader {
    private _provider;
    private _defaultStrategy;
    private readonly _logger?;
    /**
     * @param provider Database provider used for underlying queries.
     */
    constructor(provider: DatabaseProvider, logger?: {
        warn(message: string, error?: unknown): void;
    });
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
    /** Populate relationship properties on an entity according to options. */
    private loadRelationships;
    /** Batched variant to reduce N+1 queries when loading many entities. */
    private loadRelationshipsBatched;
    populateRelationships<T>(entity: T, entityClass: new () => T, options: LoadingOptions): Promise<void>;
    populateRelationshipsMany<T>(entities: T[], entityClass: new () => T, options: LoadingOptions): Promise<void>;
    private resolveTargetEntity;
    private defaultForeignKeyFor;
    private ensureStage3Init;
    private validateIncludes;
    private shouldInclude;
    private loadToOne;
    private loadOneToMany;
    private getPrimaryKeyColumnName;
    private loadRelationshipByType;
    private loadRelationshipBatchedByType;
    private loadToOneBatched;
    private loadOneToManyBatched;
}
//# sourceMappingURL=EntityLoader.d.ts.map