/** In-memory CountCache with TTL and max size (FIFO eviction). */
export class InMemoryCountCache {
    constructor(ttlMs = 10000, maxSize = 2000) {
        this.ttlMs = ttlMs;
        this.maxSize = maxSize;
        this.store = new Map();
    }
    get(key) {
        const hit = this.store.get(key);
        if (!hit)
            return undefined;
        if (this.ttlMs > 0 && Date.now() - hit.ts > this.ttlMs) {
            this.store.delete(key);
            return undefined;
        }
        return hit;
    }
    set(key, entry) {
        if (this.store.size >= this.maxSize) {
            const first = this.store.keys().next().value;
            if (first !== undefined)
                this.store.delete(first);
        }
        this.store.set(key, entry);
    }
    clear() {
        this.store.clear();
    }
    invalidateBy(matcher) {
        let removed = 0;
        for (const k of Array.from(this.store.keys())) {
            if (matcher(k)) {
                this.store.delete(k);
                removed++;
            }
        }
        return removed;
    }
}
//# sourceMappingURL=CountCache.js.map