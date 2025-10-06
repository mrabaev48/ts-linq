import { createHash } from 'node:crypto';
/**
 * Enhanced SQL Cache with TTL, LRU eviction, key optimization, and performance tracking
 */
export class EnhancedSqlCache {
  constructor(options = {}) {
    this.store = new Map();
    this.keyMap = new Map(); // original -> compressed key mapping
    const isTestEnv =
      typeof process !== 'undefined' &&
      (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test');
    this.options = {
      maxSize: options.maxSize ?? 2000,
      // In tests, disable periodic cleanup by default to avoid open handle leaks
      defaultTtl: options.defaultTtl ?? (isTestEnv ? 0 : 300000), // 5 minutes default in non-test
      enableLru: options.enableLru ?? true,
      enableKeyCompression: options.enableKeyCompression ?? true,
      compressionThreshold: options.compressionThreshold ?? 200,
      enableMetrics: options.enableMetrics ?? true,
      warmingBatchSize: options.warmingBatchSize ?? 50
    };
    this.metrics = this.initializeMetrics();
    // Set up periodic cleanup if TTL is enabled
    if (this.options.defaultTtl > 0) {
      this.startPeriodicCleanup();
    }
  }
  /**
   * Get cached SQL entry with TTL and LRU support
   */
  get(key) {
    if (this.options.enableMetrics) {
      this.metrics.totalRequests++;
    }
    const compressedKey = this.getCompressedKey(key);
    const entry = this.store.get(compressedKey);
    if (!entry) {
      if (this.options.enableMetrics) {
        this.metrics.misses++;
        this.updateHitRatio();
      }
      return undefined;
    }
    // Check TTL expiration
    if (this.isExpired(entry)) {
      this.store.delete(compressedKey);
      if (this.options.enableMetrics) {
        this.metrics.expirations++;
        this.metrics.misses++;
        this.updateHitRatio();
      }
      return undefined;
    }
    // Update access tracking
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    // LRU: move to end (most recently used)
    if (this.options.enableLru) {
      this.store.delete(compressedKey);
      this.store.set(compressedKey, entry);
    }
    if (this.options.enableMetrics) {
      this.metrics.hits++;
      this.updateHitRatio();
    }
    return {
      query: entry.query,
      parameters: [...entry.parameters]
    };
  }
  /**
   * Set cached SQL entry with TTL and smart eviction
   */
  set(key, value, customTtl) {
    const compressedKey = this.getCompressedKey(key);
    const now = Date.now();
    const ttl = customTtl ?? this.options.defaultTtl;
    // Create enhanced entry
    const enhancedEntry = {
      query: value.query,
      parameters: [...value.parameters],
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      ttl
    };
    // Check if we need to evict entries
    this.ensureCapacity();
    this.store.set(compressedKey, enhancedEntry);
    // Store key mapping if compressed
    if (this.options.enableKeyCompression && key.length > this.options.compressionThreshold) {
      this.keyMap.set(key, compressedKey);
    }
    if (this.options.enableMetrics) {
      this.metrics.currentSize = this.store.size;
      this.updateMemoryUsage();
    }
  }
  /**
   * Clear entire cache
   */
  clear() {
    this.store.clear();
    this.keyMap.clear();
    if (this.options.enableMetrics) {
      this.metrics = this.initializeMetrics();
    }
  }
  /**
   * Get current cache size
   */
  size() {
    return this.store.size;
  }
  /**
   * Get comprehensive cache metrics
   */
  getMetrics() {
    if (!this.options.enableMetrics) {
      return this.initializeMetrics();
    }
    // Update dynamic metrics
    this.metrics.currentSize = this.store.size;
    this.updateMemoryUsage();
    this.updateAverageAccessCount();
    return { ...this.metrics };
  }
  /**
   * Manually expire entries (useful for testing or forced cleanup)
   */
  expireEntries() {
    let expiredCount = 0;
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
        expiredCount++;
      }
    }
    if (this.options.enableMetrics) {
      this.metrics.expirations += expiredCount;
      this.metrics.currentSize = this.store.size;
    }
    return expiredCount;
  }
  /**
   * Warm cache with frequently used queries
   */
  warm(entries) {
    const batches = this.chunkArray(entries, this.options.warmingBatchSize);
    for (const batch of batches) {
      for (const entry of batch) {
        this.set(entry.key, entry.value, entry.ttl);
      }
    }
  }
  /**
   * Get cache statistics for optimization insights
   */
  getOptimizationInsights() {
    const metrics = this.getMetrics();
    // Analyze patterns
    const shouldIncreaseSize =
      metrics.hitRatio < 0.7 && metrics.evictions > metrics.currentSize * 0.1;
    const shouldDecreaseTtl = metrics.expirations > metrics.totalRequests * 0.2;
    const shouldIncreaseTtl =
      metrics.hitRatio > 0.95 && metrics.expirations < metrics.totalRequests * 0.05;
    // Get top accessed entries
    const topAccessed = Array.from(this.store.entries())
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);
    return {
      shouldIncreaseSize,
      shouldDecreaseTtl,
      shouldIncreaseTtl,
      topAccessedEntries: topAccessed
    };
  }
  // Private helper methods
  getCompressedKey(originalKey) {
    if (
      !this.options.enableKeyCompression ||
      originalKey.length <= this.options.compressionThreshold
    ) {
      return originalKey;
    }
    const existing = this.keyMap.get(originalKey);
    if (existing) {
      return existing;
    }
    // Create compressed key using SHA-256 hash
    const hash = createHash('sha256').update(originalKey).digest('hex');
    const compressedKey = `hash_${hash.substring(0, 16)}`; // Use first 16 chars of hash
    return compressedKey;
  }
  isExpired(entry) {
    if (entry.ttl <= 0) return false; // No expiration for ttl <= 0
    return Date.now() - entry.createdAt > entry.ttl;
  }
  ensureCapacity() {
    if (this.store.size < this.options.maxSize) return;
    const entriesToEvict = Math.floor(this.options.maxSize * 0.1) || 1; // Evict 10% or at least 1
    let evictedCount = 0;
    if (this.options.enableLru) {
      // LRU: evict least recently used entries (from beginning of Map)
      const keysToDelete = [];
      for (const [key] of this.store) {
        keysToDelete.push(key);
        evictedCount++;
        if (evictedCount >= entriesToEvict) break;
      }
      keysToDelete.forEach((key) => this.store.delete(key));
    } else {
      // FIFO: evict oldest entries
      const keysToDelete = [];
      for (const [key] of this.store) {
        keysToDelete.push(key);
        evictedCount++;
        if (evictedCount >= entriesToEvict) break;
      }
      keysToDelete.forEach((key) => this.store.delete(key));
    }
    if (this.options.enableMetrics) {
      this.metrics.evictions += evictedCount;
    }
  }
  initializeMetrics() {
    return {
      totalRequests: 0,
      hits: 0,
      misses: 0,
      hitRatio: 0,
      evictions: 0,
      expirations: 0,
      currentSize: 0,
      averageAccessCount: 0,
      estimatedMemoryUsage: 0
    };
  }
  updateHitRatio() {
    if (this.metrics.totalRequests > 0) {
      this.metrics.hitRatio = this.metrics.hits / this.metrics.totalRequests;
    }
  }
  updateMemoryUsage() {
    let totalSize = 0;
    for (const entry of this.store.values()) {
      totalSize += entry.query.length * 2; // Rough estimate: 2 bytes per char
      totalSize += entry.parameters.length * 20; // Rough estimate: 20 bytes per parameter
      totalSize += 64; // Overhead for entry metadata
    }
    this.metrics.estimatedMemoryUsage = totalSize;
  }
  updateAverageAccessCount() {
    if (this.store.size === 0) {
      this.metrics.averageAccessCount = 0;
      return;
    }
    const totalAccess = Array.from(this.store.values()).reduce(
      (sum, entry) => sum + entry.accessCount,
      0
    );
    this.metrics.averageAccessCount = totalAccess / this.store.size;
  }
  startPeriodicCleanup() {
    const cleanupInterval = Math.max(this.options.defaultTtl / 4, 60000); // Cleanup every TTL/4 or 1 minute minimum
    this.cleanupInterval = setInterval(() => {
      this.expireEntries();
    }, cleanupInterval);
    // Prevent the interval from keeping the event loop alive in tests/process exit
    // NodeJS.Timeout supports unref() in Node environments
    // Best-effort: unref is not available in all environments
    const maybe = this.cleanupInterval;
    maybe?.unref?.();
  }
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  /**
   * Dispose of the cache and clean up resources
   */
  dispose() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }
}
//# sourceMappingURL=EnhancedSqlCache.js.map
