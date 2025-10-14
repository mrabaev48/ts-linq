import { safeCacheEvicted } from 'metrics-safe';
import type { EntityCacheLike } from './EntityCache';
import { logInternalError } from './InternalLogger';

/**
 * Simple in-memory FIFO cache for entities keyed by `<EntityName>|<id>`.
 * Intended as a best-effort level-2 cache to reduce allocations and mapping work.
 */
export class EntityCache implements EntityCacheLike {
  private _store: Map<string, unknown> = new Map();
  private _maxSize: number;
  private _logger?: unknown;
  private _providerLabel?: string;

  /**
   * @param maxSize Maximum number of cached items before FIFO eviction.
   */
  constructor(maxSize: number = 10000, logger?: unknown, providerLabel?: string) {
    this._maxSize = maxSize;
    this._logger = logger;
    this._providerLabel = providerLabel;
  }

  /** Build a stable cache key from entity constructor and id. */
  private buildKey(entityClass: Function, id: unknown): string {
    return `${entityClass.name}|${String(id)}`;
  }

  /** Retrieve a cached entity instance by class and id. */
  public get<T>(entityClass: Function, id: unknown): T | undefined {
    if (id === undefined || id === null) return undefined;
    const key = this.buildKey(entityClass, id);
    return this._store.get(key) as T | undefined;
  }

  /** Store an entity instance with FIFO eviction when size exceeds limit. */
  public set<T>(entityClass: Function, id: unknown, entity: T): void {
    if (id === undefined || id === null) return;
    if (this._store.size >= this._maxSize) {
      const firstKey = this._store.keys().next().value;
      if (firstKey !== undefined) {
        this._store.delete(firstKey);
        try {
          safeCacheEvicted(this._logger, { cache: 'entityL2', provider: this._providerLabel });
        } catch (e) {
          logInternalError('EntityCache.safeCacheEvicted', e);
        }
      }
    }
    const key = this.buildKey(entityClass, id);
    this._store.set(key, entity as unknown as object);
  }

  /** Remove a cached entity by class and id. */
  public remove(entityClass: Function, id: unknown): void {
    if (id === undefined || id === null) return;
    const key = this.buildKey(entityClass, id);
    this._store.delete(key);
  }

  /** Clear all cached entities. */
  public clear(): void {
    this._store.clear();
  }

  /** Current number of cached items. */
  public size(): number {
    return this._store.size;
  }
}
