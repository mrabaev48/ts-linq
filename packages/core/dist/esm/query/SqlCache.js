/** Simple in-memory FIFO SqlCache with max size. */
export class InMemorySqlCache {
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
//# sourceMappingURL=SqlCache.js.map
