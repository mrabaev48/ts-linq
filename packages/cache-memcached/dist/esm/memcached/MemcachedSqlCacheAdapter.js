export class MemcachedSqlCacheAdapter {
    constructor(client, options) {
        this.shadow = new Map();
        this._metrics = { requests: 0, hits: 0, misses: 0, evictions: 0, invalidations: 0 };
        this.client = client;
        this.ttlSeconds = options?.ttlSeconds;
        this.keyPrefix = options?.keyPrefix ?? 'tslnq:sql:';
        this.shadowMaxSize = options?.shadowMaxSize ?? 2000;
        this.shadowTtlMs = options?.shadowTtlMs ?? 0;
        this.hashKeys = options?.hashKeys ?? false;
    }
    k(key) {
        const candidate = this.hashKeys ? this.h(key) : key;
        return this.keyPrefix + candidate;
    }
    decode(b) {
        if (!b)
            return null;
        try {
            return b.toString('utf8');
        }
        catch {
            return null;
        }
    }
    get(key) {
        this._metrics.requests++;
        const entry = this.shadow.get(key);
        if (!entry)
            return undefined;
        if (this.shadowTtlMs && this.shadowTtlMs > 0 && Date.now() - entry.ts > this.shadowTtlMs) {
            this.shadow.delete(key);
            this._metrics.misses++;
            return undefined;
        }
        this._metrics.hits++;
        // LRU touch
        this.shadow.delete(key);
        this.shadow.set(key, { value: entry.value, ts: entry.ts });
        return { query: entry.value.query, parameters: [...entry.value.parameters] };
    }
    async getAsync(key) {
        this._metrics.requests++;
        const entry = this.shadow.get(key);
        if (entry) {
            if (this.shadowTtlMs && this.shadowTtlMs > 0 && Date.now() - entry.ts > this.shadowTtlMs) {
                this.shadow.delete(key);
                // Fall through to remote fetch
            }
            else {
                this._metrics.hits++;
                // LRU touch
                this.shadow.delete(key);
                this.shadow.set(key, { value: entry.value, ts: entry.ts });
                return { query: entry.value.query, parameters: [...entry.value.parameters] };
            }
        }
        // Shadow miss (or expired) - try remote
        this._metrics.misses++;
        try {
            const remoteResult = await this.client.get(this.k(key));
            const remoteValue = remoteResult?.value ?? null;
            const decoded = this.decode(remoteValue);
            if (!decoded)
                return undefined;
            const parsed = JSON.parse(decoded);
            // Hydrate shadow
            this.ensureCapacity();
            this.shadow.set(key, {
                value: { query: parsed.query, parameters: [...parsed.parameters] },
                ts: Date.now()
            });
            return { query: parsed.query, parameters: [...parsed.parameters] };
        }
        catch {
            return undefined;
        }
    }
    set(key, value) {
        this.ensureCapacity();
        this.shadow.set(key, {
            value: { query: value.query, parameters: [...value.parameters] },
            ts: Date.now()
        });
        const payload = JSON.stringify({ query: value.query, parameters: value.parameters });
        const options = this.ttlSeconds && this.ttlSeconds > 0 ? { expires: this.ttlSeconds } : undefined;
        void (async () => {
            try {
                await this.client.set(this.k(key), payload, options);
            }
            catch {
                // Ignore write-through errors
            }
        })();
    }
    clear() {
        const removed = this.shadow.size;
        this.shadow.clear();
        this._metrics.invalidations += removed;
    }
    size() {
        return this.shadow.size;
    }
    invalidateBy(matcher) {
        let removed = 0;
        for (const k of Array.from(this.shadow.keys())) {
            if (matcher(k)) {
                this.shadow.delete(k);
                removed++;
                void (async () => {
                    try {
                        await this.client.delete(this.k(k));
                    }
                    catch {
                        // Ignore delete errors
                    }
                })();
                this._metrics.invalidations++;
            }
        }
        return removed;
    }
    getMetrics() {
        return {
            currentSize: this.shadow.size,
            totalRequests: this._metrics.requests,
            hits: this._metrics.hits,
            misses: this._metrics.misses,
            evictions: this._metrics.evictions,
            invalidations: this._metrics.invalidations
        };
    }
    ensureCapacity() {
        while (this.shadow.size >= this.shadowMaxSize) {
            const first = this.shadow.keys().next().value;
            if (first === undefined)
                break;
            this.shadow.delete(first);
            this._metrics.evictions++;
            void (async () => {
                try {
                    await this.client.delete(this.k(first));
                }
                catch {
                    // Ignore delete errors
                }
            })();
        }
    }
    h(key) {
        let hash = 5381;
        for (let i = 0; i < key.length; i++)
            hash = (hash * 33) ^ key.charCodeAt(i);
        return (hash >>> 0).toString(16);
    }
}
//# sourceMappingURL=MemcachedSqlCacheAdapter.js.map