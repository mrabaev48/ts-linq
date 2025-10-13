"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemcachedSqlCacheAdapter = void 0;
class MemcachedSqlCacheAdapter {
    constructor(client, options) {
        this.shadow = new Map();
        this.client = client;
        this.ttlSeconds = options?.ttlSeconds;
        this.keyPrefix = options?.keyPrefix ?? 'tslnq:sql:';
    }
    k(key) {
        return this.keyPrefix + key;
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
        return this.shadow.get(key);
    }
    set(key, value) {
        this.shadow.set(key, { query: value.query, parameters: [...value.parameters] });
        const payload = JSON.stringify({ query: value.query, parameters: value.parameters });
        const options = this.ttlSeconds && this.ttlSeconds > 0 ? { expires: this.ttlSeconds } : undefined;
        void this.client.set(this.k(key), payload, options);
    }
    clear() {
        this.shadow.clear();
    }
    size() {
        return this.shadow.size;
    }
}
exports.MemcachedSqlCacheAdapter = MemcachedSqlCacheAdapter;
//# sourceMappingURL=MemcachedSqlCacheAdapter.js.map