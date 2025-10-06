'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const QueryBuilder_1 = require('../src/query/QueryBuilder');
class DummyDialect {
  constructor() {
    this.calls = 0;
  }
  buildSelect(_entityClass, _options) {
    this.calls++;
    return { query: 'SELECT 1', parameters: [] };
  }
}
class InMemorySqlCache {
  constructor() {
    this.map = new Map();
  }
  get(key) {
    return this.map.get(key);
  }
  set(key, value) {
    this.map.set(key, value);
  }
  clear() {
    this.map.clear();
  }
  size() {
    return this.map.size;
  }
}
class E {}
describe('QueryBuilder external SqlCache injection', () => {
  beforeEach(() => QueryBuilder_1.QueryBuilder.clearCache());
  test('uses injected cache (miss then hit) and reduces dialect calls', () => {
    const dialect = new DummyDialect();
    const cache = new InMemorySqlCache();
    const qb = new QueryBuilder_1.QueryBuilder(dialect, undefined, 'sqlite', cache);
    const opts = { where: [] };
    const a = qb.generateSql(E, opts);
    const b = qb.generateSql(E, opts);
    expect(a.query).toBe('SELECT 1');
    expect(b.query).toBe('SELECT 1');
    expect(cache.size()).toBe(1);
    expect(dialect.calls).toBe(1);
  });
});
//# sourceMappingURL=querybuilder-cache-injection.test.js.map
