export class MemcachedCountCacheAdapter {
    constructor(client, options) {
        this.shadow = new Map();
        this.client = client;
        this.ttlSeconds = options?.ttlSeconds;
        this.keyPrefix = options?.keyPrefix ?? 'tslnq:cnt:';
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
    set(key, entry) {
        this.shadow.set(key, { value: entry.value, ts: entry.ts });
        const payload = JSON.stringify(entry);
        const options = this.ttlSeconds && this.ttlSeconds > 0 ? { expires: this.ttlSeconds } : undefined;
        void this.client.set(this.k(key), payload, options);
    }
    clear() {
        this.shadow.clear();
    }
}
//# sourceMappingURL=MemcachedCountCacheAdapter.js.map