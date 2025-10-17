import type { DatabaseProvider } from '../DatabaseProvider';
import { ChangeTracker } from '../change-tracking/ChangeTracker';
import { EntityLoader } from '../loading/EntityLoader';
import type { LoadingOptions } from '../loading/LoadingStrategy';
import { LoadingStrategy } from '../loading/LoadingStrategy';
import { DbSet } from './DbSet';
import type { DbContextOptions, Result } from '../types';
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
export declare abstract class DbContext {
    private _provider;
    private _changeTracker;
    private _entityLoader;
    private _dbSets;
    private _defaultLoadingStrategy;
    private _entityCache?;
    private _performanceOptions?;
    private _loadingDefaults;
    private _softDelete?;
    private _audit?;
    private _globalFilters?;
    private _diagnostics?;
    private _memoryProfiler?;
    private _validationOptions?;
    private _validationService;
    private _insertCmd;
    private _updateCmd;
    private _deleteCmd;
    /** Cache of validation rules per entity class to avoid repeated metadata lookups. */
    private _validationRulesCache;
    /**
     * Create a new database context instance.
     *
     * @param options Connection and provider configuration.
     */
    constructor(options: DbContextOptions);
    /**
     * Get a DbSet for the specified entity type
     *
     * @param entityClass Constructor of the entity type.
     * @returns Configured `DbSet` instance.
     */
    set<T extends object>(entityClass: new () => T): DbSet<T>;
    /**
     * Initialize the database and create tables
     *
     * Connects the provider and creates tables for all registered entities.
     */
    ensureCreated(): Promise<void>;
    /**
     * Save all changes tracked by the change tracker
     * Similar to Entity Framework's SaveChanges()
     *
     * @returns Number of affected rows.
     */
    saveChanges(): Promise<number>;
    /** Try-version of saveChanges without throwing exceptions. */
    trySaveChanges(): Promise<Result<number, Error>>;
    /**
     * Start a database transaction
     */
    beginTransaction(): Promise<void>;
    /**
     * Commit the current transaction
     */
    commitTransaction(): Promise<void>;
    /**
     * Rollback the current transaction
     */
    rollbackTransaction(): Promise<void>;
    /**
     * Smart invalidation hook executed on successful commit.
     * Current implementation clears entire L2 cache; later can be refined per-entity via metadata.
     */
    private invalidateCachesOnCommit;
    /**
     * Targeted cache invalidation after saveChanges.
     * - Removes deleted entities from L2 by primary key
     * - Clears L2 entirely if any dependent CachePolicy requires invalidation
     * - Clears global count cache (best-effort)
     */
    private invalidateCachesAfterSave;
    private computeNeedFullL2Clear;
    private removeDeletedFromEntityCache;
    private invalidateSqlCacheByNames;
    private invalidateCountCacheByNames;
    /** Simple cache utilities (warm-up etc.). */
    readonly cache: {
        readonly warmUp: (options?: {
            queries?: ReadonlyArray<() => Promise<unknown> | unknown>;
        }) => Promise<void>;
        readonly invalidateByEntity: (entityNames: ReadonlyArray<string>) => void;
        readonly reportMetrics: () => void;
    };
    /**
     * Dispose of the database connection
     */
    dispose(): Promise<void>;
    /**
     * Get the underlying database provider
     *
     * @returns The active `DatabaseProvider` implementation.
     */
    protected get provider(): DatabaseProvider;
    /**
     * Get the change tracker
     *
     * @returns The `ChangeTracker` handling entity states.
     */
    protected get changeTracker(): ChangeTracker;
    /**
     * Get the entity loader
     *
     * @returns The `EntityLoader` used for eager/lazy loading.
     */
    protected get entityLoader(): EntityLoader;
    /**
     * Set the default loading strategy
     *
     * @param strategy Loading strategy to use by default.
     */
    setLoadingStrategy(strategy: LoadingStrategy): void;
    /**
     * Find an entity by ID with loading options.
     * Entity Framework style method that returns lazy loading proxies by default.
     *
     * @param entityClass Constructor of the entity type.
     * @param id Primary key value.
     * @param options Loading options (strategy, includes, depth).
     * @returns The found entity or null with lazy loading enabled by default.
     */
    find<T extends object>(entityClass: new () => T, id: unknown, options?: LoadingOptions): Promise<T | null>;
    /**
     * Find entities with loading options.
     * Entity Framework style method that returns lazy loading proxies by default.
     *
     * @param entityClass Constructor of the entity type.
     * @param options Loading options (strategy, includes, depth).
     * @returns Array of loaded entities with lazy loading enabled by default.
     */
    findAll<T extends object>(entityClass: new () => T, options?: LoadingOptions): Promise<T[]>;
    /**
     * Load navigation properties for an entity (Entity Framework style Include).
     * Useful for explicitly loading relationships on already-loaded entities.
     */
    include<T extends object>(entity: T, entityClass: new () => T, ...propertyNames: string[]): Promise<void>;
    /**
     * Check if navigation property is loaded (Entity Framework style IsLoaded).
     */
    isLoaded<T extends object>(entity: T, propertyName: string): boolean;
    /**
     * Initialize DbSets for all registered entities.
     *
     * This method also defines auto-generated properties on the context instance
     * for each entity using a simple naming convention (see class JSDoc). If your
     * code expects different names, prefer `set(Entity)` or add your own proxy
     * getters that delegate to `set(Entity)`.
     */
    private initializeDbSets;
    /** Basic model validation: not-null and length. */
    private validateChanges;
    private prefillDefaults;
    private normalizeForValidation;
    private normalizeChange;
    private applyAudit;
    private applyCreatedAudit;
    private applyUpdatedAudit;
    private hasProperty;
    private processChange;
    private applyInsert;
    private applyUpdate;
    private applyDelete;
    private handleSoftDelete;
    private updateEntityCache;
    private removeFromEntityCache;
    private getPrimaryKey;
    /**
     * Retrieve cached validation rules for an entity class (Reflect metadata → cache).
     */
    private getValidationRules;
    private extractAuditNames;
    private validateComputedColumn;
    private validateNullAndLength;
    private isGeneratedPrimaryKey;
    private canBeSatisfiedByAudit;
    private runConditionalValidations;
    private buildValidationDetail;
}
//# sourceMappingURL=DbContext.d.ts.map