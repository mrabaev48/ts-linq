"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCountCacheAdapter = void 0;
class RedisCountCacheAdapter {
    constructor(client, options) {
        this.shadow = new Map();
        this.client = client;
        this.ttlSeconds = options?.ttlSeconds;
        this.keyPrefix = options?.keyPrefix ?? 'tslnq:cnt:';
    }
    k(key) {
        return this.keyPrefix + key;
    }
    get(key) {
        return this.shadow.get(key);
    }
    set(key, entry) {
        this.shadow.set(key, { value: entry.value, ts: entry.ts });
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
            catch {
                // ignore
            }
        })();
    }
    clear() {
        this.shadow.clear();
    }
}
exports.RedisCountCacheAdapter = RedisCountCacheAdapter;
//# sourceMappingURL=RedisCountCacheAdapter.js.map