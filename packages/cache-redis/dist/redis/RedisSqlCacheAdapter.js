"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisSqlCacheAdapter = void 0;
class RedisSqlCacheAdapter {
    constructor(client, options) {
        this.shadow = new Map();
        this.client = client;
        this.ttlSeconds = options?.ttlSeconds;
        this.keyPrefix = options?.keyPrefix ?? 'tslnq:sql:';
        this.writeThrough = options?.writeThrough ?? true;
    }
    k(key) {
        return this.keyPrefix + key;
    }
    get(key) {
        return this.shadow.get(key);
    }
    set(key, value) {
        this.shadow.set(key, { query: value.query, parameters: [...value.parameters] });
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
                // ignore write errors; shadow still serves
            }
        })();
    }
    clear() {
        this.shadow.clear();
    }
    // Not efficient to compute remotely; return -1 to indicate external cache without local size.
    size() {
        return this.shadow.size;
    }
}
exports.RedisSqlCacheAdapter = RedisSqlCacheAdapter;
//# sourceMappingURL=RedisSqlCacheAdapter.js.map