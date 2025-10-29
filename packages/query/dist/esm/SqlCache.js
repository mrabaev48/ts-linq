/** Simple in-memory FIFO SqlCache with max size. */
export class InMemorySqlCache {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.store = new Map();
    }
    get(key) {
        const hit = this.store.get(key);
        if (!hit)
            return undefined;
        return { query: hit.query, parameters: [...hit.parameters] };
    }
    set(key, value) {
        if (this.store.size >= this.maxSize) {
            const first = this.store.keys().next().value;
            if (first !== undefined)
                this.store.delete(first);
        }
        this.store.set(key, { query: value.query, parameters: [...value.parameters] });
    }
    clear() {
        this.store.clear();
    }
    size() {
        return this.store.size;
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
//# sourceMappingURL=SqlCache.js.map