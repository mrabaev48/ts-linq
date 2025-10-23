"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCountCacheAdapter = void 0;
class RedisCountCacheAdapter {
    constructor(client, options) {
        this.shadow = new Map();
        this._metrics = { requests: 0, hits: 0, misses: 0, evictions: 0, invalidations: 0 };
        this.client = client;
        this.ttlSeconds = options?.ttlSeconds;
        this.keyPrefix = options?.keyPrefix ?? 'tslnq:cnt:';
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
                    if (msg.t === 'del' && msg.k)
                        this.shadow.delete(msg.k);
                }
                catch { }
            });
        }
    }
    k(key) {
        const candidate = this.hashKeys ? this.h(key) : key;
        return this.keyPrefix + candidate;
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
        return entry.value.value;
    }
    set(key, value) {
        this.ensureCapacity();
        const entry = { value, ts: Date.now() };
        this.shadow.set(key, { value: entry, ts: Date.now() });
        const payload = JSON.stringify(entry);
        void (async () => {
            try {
                if (this.ttlSeconds && this.ttlSeconds > 0) {
                    await this.client.set(this.k(key), payload, 'EX', this.ttlSeconds);
                }
                else {
                    await this.client.set(this.k(key), payload);
                }
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[RedisCountCacheAdapter] write-through failed', { key: this.k(key) });
            }
        })();
    }
    clear() {
        this.shadow.clear();
        if (this.pubSubChannel && this.publisher)
            void this.publisher.publish(this.pubSubChannel, JSON.stringify({ t: 'clear' }));
        // invalidations add size of previous map; not tracked precisely here
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
                    catch (e) {
                        // eslint-disable-next-line no-console
                        console.warn('[RedisCountCacheAdapter] delete failed', { key: this.k(k) });
                    }
                })();
                if (this.pubSubChannel && this.publisher)
                    void this.publisher.publish(this.pubSubChannel, JSON.stringify({ t: 'del', k }));
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
            void (async () => {
                try {
                    await this.client.del(this.k(first));
                }
                catch {
                    /* ignore */
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
        let hash = 5381;
        for (let i = 0; i < key.length; i++)
            hash = (hash * 33) ^ key.charCodeAt(i);
        return (hash >>> 0).toString(16);
    }
}
exports.RedisCountCacheAdapter = RedisCountCacheAdapter;
//# sourceMappingURL=RedisCountCacheAdapter.js.map