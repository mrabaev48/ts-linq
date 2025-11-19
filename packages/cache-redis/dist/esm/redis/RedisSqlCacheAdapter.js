export class RedisSqlCacheAdapter {
    constructor(client, options) {
        this.shadow = new Map();
        this._metrics = { requests: 0, hits: 0, misses: 0, evictions: 0, invalidations: 0 };
        this.client = client;
        this.ttlSeconds = options?.ttlSeconds;
        this.keyPrefix = options?.keyPrefix ?? 'tslnq:sql:';
        this.writeThrough = options?.writeThrough ?? true;
        this.shadowMaxSize = options?.shadowMaxSize ?? 2000;
        this.shadowTtlMs = options?.shadowTtlMs ?? 0;
        this.hashKeys = options?.hashKeys ?? false;
        this.pubSubChannel = options?.pubSubChannel;
        this.publisher = options?.publisher;
        const sub = options?.subscriber;
        if (this.pubSubChannel && sub) {
            sub.subscribe(this.pubSubChannel, (message) => {
                try {
                    const msg = JSON.parse(message);
                    if (msg.t === 'clear') {
                        this.shadow.clear();
                        return;
                    }
                    if (msg.t === 'del' && msg.k) {
                        this.shadow.delete(msg.k);
                    }
                }
                catch {
                    // Ignore message parse errors
                }
            });
        }
    }
    k(key) {
        const candidate = this.hashKeys ? this.h(key) : key;
        return this.keyPrefix + candidate;
    }
    get(key) {
        const entry = this.shadow.get(key);
        if (!entry)
            return undefined;
        if (this.shadowTtlMs && this.shadowTtlMs > 0 && Date.now() - entry.ts > this.shadowTtlMs) {
            this.shadow.delete(key);
            return undefined;
        }
        // LRU: move to end
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
                // LRU: move to end
                this.shadow.delete(key);
                this.shadow.set(key, { value: entry.value, ts: entry.ts });
                return { query: entry.value.query, parameters: [...entry.value.parameters] };
            }
        }
        // Shadow miss (or expired) - try remote
        this._metrics.misses++;
        try {
            const remoteValue = await this.client.get(this.k(key));
            if (!remoteValue)
                return undefined;
            const parsed = JSON.parse(remoteValue);
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
        if (!this.writeThrough)
            return;
        const payload = JSON.stringify({ query: value.query, parameters: value.parameters });
        // Fire-and-forget write-through
        void (async () => {
            try {
                if (this.ttlSeconds && this.ttlSeconds > 0) {
                    await this.client.set(this.k(key), payload, 'EX', this.ttlSeconds);
                }
                else {
                    await this.client.set(this.k(key), payload);
                }
            }
            catch {
                // Ignore write-through errors
            }
        })();
    }
    clear() {
        this.shadow.clear();
        if (this.pubSubChannel && this.publisher) {
            void this.publisher.publish(this.pubSubChannel, JSON.stringify({ t: 'clear' }));
        }
    }
    // Not efficient to compute remotely; return -1 to indicate external cache without local size.
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
                        await this.client.del(this.k(k));
                    }
                    catch {
                        // Ignore delete errors
                    }
                })();
                if (this.pubSubChannel && this.publisher) {
                    void this.publisher.publish(this.pubSubChannel, JSON.stringify({ t: 'del', k }));
                }
                this._metrics.invalidations++;
            }
        }
        return removed;
    }
    ensureCapacity() {
        while (this.shadow.size >= this.shadowMaxSize) {
            const first = this.shadow.keys().next().value;
            if (first === undefined)
                break;
            this.shadow.delete(first);
            this._metrics.evictions++;
            // best-effort remote clean
            void (async () => {
                try {
                    await this.client.del(this.k(first));
                }
                catch {
                    // Ignore delete errors
                }
            })();
        }
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
    h(key) {
        // Lightweight non-crypto hash (djb2) to keep bundle small
        let hash = 5381;
        for (let i = 0; i < key.length; i++)
            hash = (hash * 33) ^ key.charCodeAt(i);
        // Convert to unsigned 32-bit and hex
        return (hash >>> 0).toString(16);
    }
}
//# sourceMappingURL=RedisSqlCacheAdapter.js.map