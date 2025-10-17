import { QueryBuilder } from '../src/query/QueryBuilder';
import type { SqlDialect } from '../src/query/SqlDialect';
import type { QueryOptions, SqlParameter, CacheInfo } from '../src/types';

class DummyDialect implements SqlDialect {
  buildSelect<T>(
    entityClass: new () => T,
    _options: QueryOptions
  ): { query: string; parameters: SqlParameter[] } {
    return { query: `SELECT * FROM ${entityClass.name}`, parameters: [] };
  }
}

class CapturingLogger {
  public cacheCalls: CacheInfo[] = [];
  cache(info: CacheInfo) {
    this.cacheCalls.push(info);
  }
}

class User {}

describe('QueryBuilder cache metrics', () => {
  it('emits cache miss then hit for the same options', () => {
    const logger = new CapturingLogger();
    const qb = new QueryBuilder(
      new DummyDialect(),
      logger as unknown as { cache?: (i: CacheInfo) => void },
      'sqlite'
    );
    const opts: QueryOptions = { select: ['*'] };
    const a = qb.generateSql(User, opts);
    const b = qb.generateSql(User, opts);
    expect(a.query).toBe(b.query);
    const hasMiss = logger.cacheCalls.some((c) => c.cache === 'sqlGen' && c.hit === false);
    const hasHit = logger.cacheCalls.some((c) => c.cache === 'sqlGen' && c.hit === true);
    expect(hasMiss).toBe(true);
    expect(hasHit).toBe(true);
  });
});


class DialectStub implements SqlDialect {
  public calls = 0;
  buildSelect<T>(entityClass: new () => T, options: QueryOptions) {
    this.calls++;
    return { query: 'SELECT x', parameters: [] };
  }
}

describe('QueryBuilder cache', () => {
  beforeEach(() => QueryBuilder.clearCache());

  test('clearCache forces regeneration', () => {
    class E {}
    const d = new DialectStub();
    const qb = new QueryBuilder(d);
    const opts: QueryOptions = {};
    qb.generateSql(E, opts);
    expect(d.calls).toBe(1);
    qb.generateSql(E, opts);
    expect(d.calls).toBe(1); // cached
    QueryBuilder.clearCache();
    qb.generateSql(E, opts);
    expect(d.calls).toBe(2);
  });
});
