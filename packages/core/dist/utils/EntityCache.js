"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityCache = void 0;
const metrics_safe_1 = require("metrics-safe");
class EntityCache {
    /**
     * @param maxSize Maximum number of cached items before FIFO eviction.
     */
    constructor(maxSize = 10000, logger, providerLabel) {
        this._store = new Map();
        this._maxSize = maxSize;
        this._logger = logger;
        this._providerLabel = providerLabel;
    }
    /** Build a stable cache key from entity constructor and id. */
    buildKey(entityClass, id) {
        return `${entityClass.name}|${String(id)}`;
    }
    /** Retrieve a cached entity instance by class and id. */
    get(entityClass, id) {
        if (id === undefined || id === null)
            return undefined;
        const key = this.buildKey(entityClass, id);
        return this._store.get(key);
    }
    /** Store an entity instance with FIFO eviction when size exceeds limit. */
    set(entityClass, id, entity) {
        if (id === undefined || id === null)
            return;
        if (this._store.size >= this._maxSize) {
            const firstKey = this._store.keys().next().value;
            if (firstKey !== undefined) {
                this._store.delete(firstKey);
                try {
                    (0, metrics_safe_1.safeCacheEvicted)(this._logger, { cache: 'entityL2', provider: this._providerLabel });
                }
                catch {
                    /* ignore */
                }
            }
        }
        const key = this.buildKey(entityClass, id);
        this._store.set(key, entity);
    }
    /** Remove a cached entity by class and id. */
    remove(entityClass, id) {
        if (id === undefined || id === null)
            return;
        const key = this.buildKey(entityClass, id);
        this._store.delete(key);
    }
    /** Clear all cached entities. */
    clear() {
        this._store.clear();
    }
    /** Current number of cached items. */
    size() {
        return this._store.size;
    }
}
exports.EntityCache = EntityCache;
//# sourceMappingURL=EntityCache.js.map