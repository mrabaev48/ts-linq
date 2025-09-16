import type { DatabaseProvider } from '../DatabaseProvider';
/**
 * Configuration options for batch operations
 */
export interface BatchOptions {
    /** Maximum number of entities to process in a single batch (default: 1000) */
    batchSize?: number;
    /** Whether to use transactions for each batch (default: true) */
    useTransactions?: boolean;
    /** Whether to continue processing if some entities fail (default: false) */
    continueOnError?: boolean;
    /** Progress callback for long-running operations */
    onProgress?: (processed: number, total: number) => void;
    /** Custom timeout per batch in milliseconds */
    timeoutMs?: number;
    /** Whether to return detailed results with errors (default: false) */
    returnDetailedResults?: boolean;
}
/**
 * Detailed result for batch operations when returnDetailedResults is enabled
 */
export interface BatchResult<T> {
    /** Successfully processed entities */
    successful: T[];
    /** Failed entities with their errors */
    failed: Array<{
        entity: T;
        error: Error;
    }>;
    /** Total number of entities processed */
    totalProcessed: number;
    /** Total time taken in milliseconds */
    durationMs: number;
    /** Number of batches executed */
    batchCount: number;
}
/**
 * Simple batch result for basic operations
 */
export interface SimpleBatchResult<T> {
    /** All processed entities (successful ones) */
    entities: T[];
    /** Number of entities that failed */
    failedCount: number;
    /** Total processing time */
    durationMs: number;
}
/**
 * Enhanced batch operations with optimizations for large datasets.
 * Provides bulk insert/update/delete operations that are much more efficient
 * than iterating through entities one by one.
 */
export declare class BatchOperations {
    private provider;
    private defaultBatchSize;
    constructor(provider: DatabaseProvider);
    /**
     * Bulk insert entities using optimized SQL bulk insert statements.
     * Much more efficient than insertMany for large datasets.
     */
    bulkInsert<T extends object>(entities: T[], entityClass: new () => T, options?: BatchOptions): Promise<BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>>;
    /**
     * Bulk update entities using optimized batch update strategies.
     */
    bulkUpdate<T extends object>(entities: T[], entityClass: new () => T, options?: BatchOptions): Promise<BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>>;
    /**
     * Bulk delete entities using optimized bulk delete operations.
     */
    bulkDelete<T extends object>(entities: T[], entityClass: new () => T, options?: BatchOptions): Promise<{
        deletedCount: number;
        failedCount: number;
        durationMs: number;
    }>;
    /**
     * Bulk upsert (insert or update) entities with optimized conflict resolution.
     */
    bulkUpsert<T extends object>(entities: T[], entityClass: new () => T, options?: BatchOptions): Promise<BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>>;
    /**
     * Execute optimized bulk insert using VALUES clause or provider-specific bulk insert.
     */
    private executeBulkInsert;
    /**
     * Execute optimized bulk update using CASE statements or batch operations.
     */
    private executeBulkUpdate;
    /**
     * Execute optimized bulk delete using IN clause.
     */
    private executeBulkDelete;
    /**
     * Execute bulk upsert using INSERT ... ON CONFLICT or provider-specific methods.
     */
    private executeBulkUpsert;
    /**
     * Split array into chunks of specified size for batch processing.
     */
    private chunkArray;
    /**
     * Get entity metadata with validation.
     */
    private getEntityMetadata;
    /**
     * Create empty result based on return type.
     */
    private createEmptyResult;
    /**
     * Set default batch size for operations.
     */
    setDefaultBatchSize(size: number): void;
    /**
     * Get current default batch size.
     */
    getDefaultBatchSize(): number;
}
//# sourceMappingURL=BatchOperations.d.ts.map