import type { DatabaseProvider } from '../DatabaseProvider';
/**
 * Symbol to store original entity data without triggering lazy loading
 */
export declare const LAZY_LOADING_TARGET: unique symbol;
/**
 * Symbol to store the database provider for lazy loading
 */
export declare const LAZY_LOADING_PROVIDER: unique symbol;
/**
 * Symbol to mark entities as lazy loading proxies
 */
export declare const LAZY_LOADING_PROXY: unique symbol;
/**
 * Symbol to store loading state for each property
 */
export declare const LAZY_LOADING_STATE: unique symbol;
/**
 * Interface for lazy loading state tracking
 */
interface LazyLoadingState {
    [propertyName: string]: {
        isLoaded: boolean;
        isLoading: boolean;
        loadingPromise?: Promise<unknown>;
    };
}
/**
 * Entity Framework-style lazy loading implementation using ES6 Proxies.
 * Automatically loads related entities when navigation properties are first accessed.
 */
export declare class LazyLoadingProxy {
    /**
     * Create a lazy loading proxy for an entity.
     * When navigation properties are accessed, they will be automatically loaded from the database.
     */
    static create<T extends object>(entity: T, entityClass: new () => T, provider: DatabaseProvider): T;
    /**
     * Create lazy loading proxies for multiple entities.
     */
    static createMany<T extends object>(entities: T[], entityClass: new () => T, provider: DatabaseProvider): T[];
    /**
     * Check if an entity is a lazy loading proxy.
     */
    static isLazyProxy(entity: unknown): boolean;
    /**
     * Get the original target entity from a lazy proxy.
     */
    static getTarget<T>(entity: T): T;
    /**
     * Get the loading state for a lazy proxy.
     */
    static getLoadingState(entity: unknown): LazyLoadingState | null;
    /**
     * Check if a specific relationship property is loaded.
     */
    static isRelationshipLoaded(entity: unknown, propertyName: string): boolean;
    /**
     * Preload specific relationships to avoid N+1 queries.
     */
    static preloadRelationships<T extends object>(entities: T[], entityClass: new () => T, propertyNames: string[], provider: DatabaseProvider): Promise<void>;
    /**
     * Load a single relationship for an entity.
     */
    private static loadRelationship;
    /**
     * Batch load relationships for multiple entities to avoid N+1 queries.
     */
    private static batchLoadRelationship;
    /**
     * Resolve a relationship target entity.
     */
    private static resolveTargetEntity;
    /**
     * Generate default foreign key name.
     */
    private static defaultForeignKeyFor;
}
/**
 * Type guard to check if an entity is a lazy loading proxy.
 */
export declare function isLazyProxy<T>(entity: T): entity is T & {
    [LAZY_LOADING_PROXY]: true;
};
/**
 * Get the original target from a lazy proxy.
 */
export declare function getLazyTarget<T>(entity: T): T;
/**
 * Utility to await lazy loading promises when accessing navigation properties.
 * Usage: await awaitLazyLoad(user.posts) to ensure posts are loaded.
 */
export declare function awaitLazyLoad<T>(propertyValue: T | Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=LazyLoadingProxy.d.ts.map