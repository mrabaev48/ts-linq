import { QueryBuilder } from '../src/query/QueryBuilder';
import { SqlDialect } from '../src/query/SqlDialect';
import { QueryOptions, SqlParameter } from '../src/types';
import { SqlCache, SqlCacheEntry } from '../src/query/SqlCache';

class DummyDialect implements SqlDialect {
  public calls = 0;
  buildSelect<T>(_entityClass: new () => T, _options: QueryOptions): { query: string; parameters: SqlParameter[] } {
    this.calls++;
    return { query: 'SELECT 1', parameters: [] };
  }
}

class InMemorySqlCache implements SqlCache {
  private map = new Map<string, SqlCacheEntry>();
  get(key: string): SqlCacheEntry | undefined {
    return this.map.get(key);
  }
  set(key: string, value: SqlCacheEntry): void {
    this.map.set(key, value);
  }
  clear(): void {
    this.map.clear();
  }
  size(): number {
    return this.map.size;
  }
}

class E {}

describe('QueryBuilder external SqlCache injection', () => {
  beforeEach(() => QueryBuilder.clearCache());

  test('uses injected cache (miss then hit) and reduces dialect calls', () => {
    const dialect = new DummyDialect();
    const cache = new InMemorySqlCache();
    const qb = new QueryBuilder(dialect, undefined, 'sqlite', cache);

    const opts: QueryOptions = { where: [] };
    const a = qb.generateSql(E as any, opts);
    const b = qb.generateSql(E as any, opts);
    expect(a.query).toBe('SELECT 1');
    expect(b.query).toBe('SELECT 1');
    expect(cache.size()).toBe(1);
    expect(dialect.calls).toBe(1);
  });
});
