import type { SqlCache, SqlCacheEntry } from '@ts-linq/types';
/**
 * Enhanced SQL cache entry with TTL and usage tracking
 */
export interface EnhancedSqlCacheEntry extends SqlCacheEntry {
    /** Timestamp when entry was created */
    createdAt: number;
    /** Timestamp when entry was last accessed */
    lastAccessedAt: number;
    /** Number of times this entry has been accessed */
    accessCount: number;
    /** TTL in milliseconds (0 means no expiration) */
    ttl: number;
}
/**
 * Cache configuration options
 */
export interface EnhancedSqlCacheOptions {
    /** Maximum number of entries before eviction starts */
    maxSize?: number;
    /** Default TTL in milliseconds (0 = no expiration) */
    defaultTtl?: number;
    /** Enable LRU eviction instead of FIFO */
    enableLru?: boolean;
    /** Enable key compression via hashing */
    enableKeyCompression?: boolean;
    /** Minimum key length to compress */
    compressionThreshold?: number;
    /** Enable detailed metrics tracking */
    enableMetrics?: boolean;
    /** Cache warming batch size */
    warmingBatchSize?: number;
}
/**
 * Cache performance metrics
 */
export interface SqlCacheMetrics {
    /** Total number of cache requests */
    totalRequests: number;
    /** Number of cache hits */
    hits: number;
    /** Number of cache misses */
    misses: number;
    /** Cache hit ratio (0-1) */
    hitRatio: number;
    /** Number of entries evicted due to size */
    evictions: number;
    /** Number of entries expired due to TTL */
    expirations: number;
    /** Current cache size */
    currentSize: number;
    /** Average access count per entry */
    averageAccessCount: number;
    /** Memory usage estimation in bytes */
    estimatedMemoryUsage: number;
}
/**
 * Enhanced SQL Cache with TTL, LRU eviction, key optimization, and performance tracking
 */
export declare class EnhancedSqlCache implements SqlCache {
    private store;
    private keyMap;
    private options;
    private metrics;
    private cleanupInterval?;
    constructor(options?: EnhancedSqlCacheOptions);
    /**
     * Get cached SQL entry with TTL and LRU support
     */
    get(key: string): SqlCacheEntry | undefined;
    /**
     * Set cached SQL entry with TTL and smart eviction
     */
    set(key: string, value: SqlCacheEntry, customTtl?: number): void;
    /**
     * Clear entire cache
     */
    clear(): void;
    /**
     * Get current cache size
     */
    size(): number;
    /**
     * Get comprehensive cache metrics
     */
    getMetrics(): SqlCacheMetrics;
    /**
     * Manually expire entries (useful for testing or forced cleanup)
     */
    expireEntries(): number;
    /**
     * Warm cache with frequently used queries
     */
    warm(entries: Array<{
        key: string;
        value: SqlCacheEntry;
        ttl?: number;
    }>): void;
    /**
     * Get cache statistics for optimization insights
     */
    getOptimizationInsights(): {
        shouldIncreaseSize: boolean;
        shouldDecreaseTtl: boolean;
        shouldIncreaseTtl: boolean;
        topAccessedEntries: Array<{
            key: string;
            accessCount: number;
        }>;
    };
    private getCompressedKey;
    private isExpired;
    private ensureCapacity;
    private initializeMetrics;
    private updateHitRatio;
    private updateMemoryUsage;
    private updateAverageAccessCount;
    private startPeriodicCleanup;
    private chunkArray;
    /**
     * Dispose of the cache and clean up resources
     */
    dispose(): void;
}
//# sourceMappingURL=EnhancedSqlCache.d.ts.map