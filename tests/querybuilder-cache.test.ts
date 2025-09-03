import 'reflect-metadata';
import { QueryBuilder } from '../src/query/QueryBuilder';
import { SqlDialect } from '../src/query/SqlDialect';

class DummyDialect implements SqlDialect {
  buildSelect<T>(entityClass: new () => T, _options: any): { query: string; parameters: any[] } {
    return { query: `SELECT * FROM ${(entityClass as any).name}`, parameters: [] };
  }
}

class CapturingLogger {
  public cacheCalls: any[] = [];
  cache(info: any) {
    this.cacheCalls.push(info);
  }
}

class User {}

describe('QueryBuilder cache metrics', () => {
  it('emits cache miss then hit for the same options', () => {
    const logger = new CapturingLogger();
    const qb = new QueryBuilder(new DummyDialect() as any, logger as any, 'sqlite');
    const opts = { select: ['*'] } as any;
    const a = qb.generateSql(User as any, opts);
    const b = qb.generateSql(User as any, opts);
    expect(a.query).toBe(b.query);
    const hasMiss = logger.cacheCalls.some((c) => c.cache === 'sqlGen' && c.hit === false);
    const hasHit = logger.cacheCalls.some((c) => c.cache === 'sqlGen' && c.hit === true);
    expect(hasMiss).toBe(true);
    expect(hasHit).toBe(true);
  });
});

import 'reflect-metadata';
// (no duplicate imports)
import { QueryOptions } from '../src/types';

class DialectStub implements SqlDialect {
  public calls = 0;
  buildSelect<T>(entityClass: new () => T, options: QueryOptions) {
    this.calls++;
    return { query: 'SELECT x', parameters: [] as any[] };
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
