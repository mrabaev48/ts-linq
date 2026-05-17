import type { SqlCache, SqlCacheEntry } from '@ts-linq/types';
import { createHash } from 'node:crypto';

export interface LruCacheOptions {
  maxSize?: number;
  enableLru?: boolean;
  enableKeyCompression?: boolean;
  compressionThreshold?: number;
}

interface LruCacheEntry extends SqlCacheEntry {
  accessCount: number;
  lastAccessedAt: number;
}

/**
 * Fixed-size Map-backed store with optional LRU promotion and SHA-256 key compression.
 * Single responsibility: entry storage and eviction policy only.
 */
export class LruCache implements SqlCache {
  private store = new Map<string, LruCacheEntry>();
  private keyMap = new Map<string, string>(); // original key → hash_ compressed key
  private readonly maxSize: number;
  private readonly enableLru: boolean;
  private readonly enableKeyCompression: boolean;
  private readonly compressionThreshold: number;

  constructor(options: LruCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 2000;
    this.enableLru = options.enableLru ?? true;
    this.enableKeyCompression = options.enableKeyCompression ?? true;
    this.compressionThreshold = options.compressionThreshold ?? 200;
  }

  get(key: string): SqlCacheEntry | undefined {
    const storeKey = this.compressKey(key);
    const entry = this.store.get(storeKey);
    if (!entry) return undefined;

    entry.accessCount++;
    entry.lastAccessedAt = Date.now();

    if (this.enableLru) {
      this.store.delete(storeKey);
      this.store.set(storeKey, entry);
    }

    return { query: entry.query, parameters: [...entry.parameters] };
  }

  set(key: string, value: SqlCacheEntry): void {
    this.ensureCapacity();

    const storeKey = this.compressKey(key);
    if (this.enableKeyCompression && key.length > this.compressionThreshold) {
      this.keyMap.set(key, storeKey);
    }

    this.store.set(storeKey, {
      query: value.query,
      parameters: [...value.parameters],
      accessCount: 1,
      lastAccessedAt: Date.now()
    });
  }

  invalidateBy(matcher: (key: string) => boolean): number {
    let removed = 0;

    // Phase 1: resolve compressed store-keys for long keys stored via keyMap
    const compressedToDelete = new Set<string>();
    for (const [original, compressed] of this.keyMap) {
      if (matcher(original)) {
        compressedToDelete.add(compressed);
        this.keyMap.delete(original);
      }
    }

    // Phase 2: single-pass over store
    for (const key of Array.from(this.store.keys())) {
      const shouldDelete =
        compressedToDelete.has(key) ||
        (!key.startsWith('hash_') && matcher(key));
      if (shouldDelete) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }

  clear(): void {
    this.store.clear();
    this.keyMap.clear();
  }

  size(): number {
    return this.store.size;
  }

  /** Returns top N entries sorted descending by accessCount. */
  getTopAccessed(n = 10): Array<{ key: string; accessCount: number }> {
    return Array.from(this.store.entries())
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, n);
  }

  private compressKey(originalKey: string): string {
    if (!this.enableKeyCompression || originalKey.length <= this.compressionThreshold) {
      return originalKey;
    }
    const existing = this.keyMap.get(originalKey);
    if (existing) return existing;

    const hash = createHash('sha256').update(originalKey).digest('hex');
    return `hash_${hash.substring(0, 16)}`;
  }

  private ensureCapacity(): void {
    if (this.store.size < this.maxSize) return;

    const entriesToEvict = Math.floor(this.maxSize * 0.1) || 1;
    let evicted = 0;
    const keysToDelete: string[] = [];

    for (const key of this.store.keys()) {
      keysToDelete.push(key);
      evicted++;
      if (evicted >= entriesToEvict) break;
    }

    keysToDelete.forEach((key) => this.store.delete(key));
  }
}
