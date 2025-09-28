'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.InMemorySqlCache = void 0;
/** Simple in-memory FIFO SqlCache with max size. */
class InMemorySqlCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.store = new Map();
  }
  get(key) {
    return this.store.get(key);
  }
  set(key, value) {
    if (this.store.size >= this.maxSize) {
      const first = this.store.keys().next().value;
      if (first !== undefined) this.store.delete(first);
    }
    this.store.set(key, { query: value.query, parameters: [...value.parameters] });
  }
  clear() {
    this.store.clear();
  }
  size() {
    return this.store.size;
  }
}
exports.InMemorySqlCache = InMemorySqlCache;
//# sourceMappingURL=SqlCache.js.map
