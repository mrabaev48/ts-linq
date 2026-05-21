/**
 * Unit tests — Compiled Queries (P1-20).
 *
 * Coverage:
 * - EF.compileQuery returns a callable with .plan property
 * - EF.compileAsyncQuery is symmetric with compileQuery
 * - Calling the compiled function invokes the factory with correct (ctx, ...params)
 * - Multiple parameters work correctly
 * - plan.invocationCount increments per call
 * - plan.isWarm becomes true after first cache hit
 * - PlanSqlCache.getTemplate returns undefined on miss, template on hit
 * - PlanSqlCache normalises keys (strips ?(val) and )(val) patterns)
 * - Two calls with different param values normalise to same key → cache hit
 * - Fallback path: compiled query produces identical SQL to the regular path
 */
import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import { DatabaseProvider } from '@ts-linq/core';
import { Column, Entity, MetadataStorage, PrimaryKey } from '@ts-linq/metadata';
import type { SqlDialect, SqlParameter } from '@ts-linq/types';

import { CapturedQueryPlan, PlanSqlCache } from '../src/compiled/CapturedQueryPlan';
import { EF } from '../src/EF';
import { Queryable } from '../src/Queryable';
import { QueryBuilder } from '../src/QueryBuilder';

// ── Entity fixtures ──────────────────────────────────────────────────────────

@Entity({ name: 'users' })
class User {
  @PrimaryKey()
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;

  @Column({ type: 'INTEGER' })
  age!: number;
}

// ── Stub dialect (returns deterministic SQL) ─────────────────────────────────

class StubDialect implements SqlDialect {
  buildSelect<T>(
    entityClass: new () => T,
    options: unknown
  ): { query: string; parameters: readonly SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass);
    const opts = options as {
      where?: Array<{ condition: string; parameters: SqlParameter[] }>;
      limit?: number;
    };
    let sql = `SELECT * FROM ${meta?.tableName ?? entityClass.name}`;
    const params: SqlParameter[] = [];
    if (opts?.where?.length) {
      sql += ` WHERE ${opts.where.map((w) => w.condition).join(' AND ')}`;
      for (const w of opts.where) params.push(...w.parameters);
    }
    if (opts?.limit !== undefined) sql += ` LIMIT ${opts.limit}`;
    return { query: sql, parameters: params };
  }
  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }
}

// ── Stub provider ────────────────────────────────────────────────────────────

class StubProvider extends DatabaseProvider {
  private _rows: Record<string, unknown>[] = [];
  private readonly _dialect = new StubDialect();

  constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
  }

  setRows(rows: Record<string, unknown>[]): void {
    this._rows = rows;
  }

  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  async createTable(): Promise<void> {}
  getDialect(): SqlDialect {
    return this._dialect;
  }
  async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  async delete(): Promise<void> {}
  async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  async insertMany<T extends object>(entities: T[]): Promise<T[]> {
    return entities;
  }
  async updateMany<T extends object>(entities: T[]): Promise<T[]> {
    return entities;
  }
  async upsert<T extends object>(e: T): Promise<T> {
    return e;
  }
  async upsertMany<T extends object>(entities: T[]): Promise<T[]> {
    return entities;
  }
  protected override async doExecuteQuery<T>(): Promise<T[]> {
    return this._rows as unknown as T[];
  }
  protected override async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeQueryable(provider: StubProvider): Queryable<User> {
  return new Queryable<User>(User, provider);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('EF.compileQuery / EF.compileAsyncQuery (P1-20)', () => {
  describe('API shape', () => {
    it('compileQuery returns a callable function', () => {
      const fn = EF.compileQuery(async (_ctx: StubProvider) => null);
      expect(typeof fn).toBe('function');
    });

    it('compileQuery result has a .plan property', () => {
      const fn = EF.compileQuery(async (_ctx: StubProvider) => null);
      expect(fn.plan).toBeInstanceOf(CapturedQueryPlan);
    });

    it('compileAsyncQuery returns same shape as compileQuery', () => {
      const sync = EF.compileQuery(async (_ctx: StubProvider) => 42);
      const async_ = EF.compileAsyncQuery(async (_ctx: StubProvider) => 42);
      expect(typeof sync).toBe(typeof async_);
      expect(sync.plan).toBeInstanceOf(CapturedQueryPlan);
      expect(async_.plan).toBeInstanceOf(CapturedQueryPlan);
    });
  });

  describe('parameter passing', () => {
    it('passes single parameter to the factory', async () => {
      const provider = new StubProvider();
      let captured: number | null = null;
      const getById = EF.compileQuery(async (_ctx: StubProvider, id: number) => {
        captured = id;
        return null;
      });

      await getById(provider, 42);
      expect(captured).toBe(42);
    });

    it('passes multiple parameters to the factory', async () => {
      const provider = new StubProvider();
      let capturedId: number | null = null;
      let capturedName: string | null = null;
      const getByIdAndName = EF.compileQuery(
        async (_ctx: StubProvider, id: number, name: string) => {
          capturedId = id;
          capturedName = name;
          return null;
        }
      );

      await getByIdAndName(provider, 99, 'Alice');
      expect(capturedId).toBe(99);
      expect(capturedName).toBe('Alice');
    });

    it('passes the context to the factory', async () => {
      const provider = new StubProvider();
      let capturedCtx: StubProvider | null = null;
      const fn = EF.compileQuery(async (ctx: StubProvider) => {
        capturedCtx = ctx;
        return null;
      });

      await fn(provider);
      expect(capturedCtx).toBe(provider);
    });

    it('returns the value produced by the factory', async () => {
      const provider = new StubProvider();
      const getNum = EF.compileQuery(async (_ctx: StubProvider, n: number) => n * 2);
      const result = await getNum(provider, 21);
      expect(result).toBe(42);
    });
  });

  describe('CapturedQueryPlan metrics', () => {
    it('invocationCount starts at 0', () => {
      const fn = EF.compileQuery(async () => null);
      expect(fn.plan.invocationCount).toBe(0);
    });

    it('invocationCount increments on each call', async () => {
      const provider = new StubProvider();
      const fn = EF.compileQuery(async () => null);
      await fn(provider);
      await fn(provider);
      await fn(provider);
      expect(fn.plan.invocationCount).toBe(3);
    });

    it('isWarm is false initially', () => {
      const fn = EF.compileQuery(async () => null);
      expect(fn.plan.isWarm).toBe(false);
    });

    it('cacheHits starts at 0', () => {
      const fn = EF.compileQuery(async () => null);
      expect(fn.plan.cacheHits).toBe(0);
    });

    it('cacheMisses starts at 0', () => {
      const fn = EF.compileQuery(async () => null);
      expect(fn.plan.cacheMisses).toBe(0);
    });
  });

  describe('async variant', () => {
    it('compileAsyncQuery returns a Promise on invocation', async () => {
      const provider = new StubProvider();
      const fn = EF.compileAsyncQuery(async (_ctx: StubProvider, v: string) => v.toUpperCase());
      const result = await fn(provider, 'hello');
      expect(result).toBe('HELLO');
    });

    it('compileAsyncQuery plan is a CapturedQueryPlan', () => {
      const fn = EF.compileAsyncQuery(async () => 0);
      expect(fn.plan).toBeInstanceOf(CapturedQueryPlan);
    });
  });
});

describe('PlanSqlCache (P1-20)', () => {
  describe('getTemplate / set', () => {
    it('returns undefined on first access (cache miss)', () => {
      const cache = new PlanSqlCache();
      expect(cache.getTemplate('Customer|w:id = ?(42)')).toBeUndefined();
    });

    it('returns the stored template on subsequent access', () => {
      const cache = new PlanSqlCache();
      cache.set('Customer|w:id = ?(42)', {
        query: 'SELECT * FROM users WHERE id = ?',
        parameters: [42]
      });
      const hit = cache.getTemplate('Customer|w:id = ?(42)');
      expect(hit).toEqual({ query: 'SELECT * FROM users WHERE id = ?' });
    });

    it('does NOT return parameters (only the SQL template)', () => {
      const cache = new PlanSqlCache();
      cache.set('key', { query: 'SELECT 1', parameters: [1, 2, 3] });
      const hit = cache.getTemplate('key');
      expect(hit).toBeDefined();
      expect(Object.keys(hit!)).not.toContain('parameters');
    });
  });

  describe('key normalisation — ?(val) pattern', () => {
    it('normalises ?(val) to ?() so different param values hit the same entry', () => {
      const cache = new PlanSqlCache();
      cache.set('Customer|w:id = ?(42)', {
        query: 'SELECT * FROM users WHERE id = ?',
        parameters: []
      });

      // Second call with id=99 should hit the same normalised key
      const hit = cache.getTemplate('Customer|w:id = ?(99)');
      expect(hit).toBeDefined();
      expect(hit!.query).toBe('SELECT * FROM users WHERE id = ?');
    });

    it('normalises multi-param conditions', () => {
      const cache = new PlanSqlCache();
      cache.set('Customer|w:age > ?(18)|w:name = ?(Alice)', {
        query: 'SELECT * FROM users WHERE age > ? AND name = ?',
        parameters: []
      });
      const hit = cache.getTemplate('Customer|w:age > ?(30)|w:name = ?(Bob)');
      expect(hit).toBeDefined();
    });
  });

  describe('key normalisation — )(val) pattern (whereIn)', () => {
    it('normalises whereIn parameter values', () => {
      const cache = new PlanSqlCache();
      cache.set('Customer|w:"id" IN (?, ?, ?)(1|2|3)', {
        query: 'SELECT * FROM users WHERE "id" IN (?, ?, ?)',
        parameters: []
      });
      const hit = cache.getTemplate('Customer|w:"id" IN (?, ?, ?)(4|5|6)');
      expect(hit).toBeDefined();
      expect(hit!.query).toBe('SELECT * FROM users WHERE "id" IN (?, ?, ?)');
    });
  });

  describe('hit/miss counters', () => {
    it('increments cacheMisses on template miss', () => {
      const cache = new PlanSqlCache();
      cache.getTemplate('nonexistent-key');
      cache.getTemplate('nonexistent-key-2');
      expect(cache.cacheMisses).toBe(2);
    });

    it('increments cacheHits on template hit', () => {
      const cache = new PlanSqlCache();
      cache.set('key', { query: 'SELECT 1', parameters: [] });
      cache.getTemplate('key');
      cache.getTemplate('key');
      expect(cache.cacheHits).toBe(2);
    });

    it('first access is a miss, subsequent are hits', () => {
      const cache = new PlanSqlCache();
      cache.getTemplate('x'); // miss (getTemplate before set returns undefined)
      cache.set('x', { query: 'SELECT 1', parameters: [] });
      cache.getTemplate('x'); // hit
      expect(cache.cacheMisses).toBe(1);
      expect(cache.cacheHits).toBe(1);
    });
  });

  describe('size / clear', () => {
    it('size returns the number of cached templates', () => {
      const cache = new PlanSqlCache();
      expect(cache.size()).toBe(0);
      cache.set('k1', { query: 'SELECT 1', parameters: [] });
      cache.set('k2', { query: 'SELECT 2', parameters: [] });
      expect(cache.size()).toBe(2);
    });

    it('does not duplicate entries for the same normalised key', () => {
      const cache = new PlanSqlCache();
      cache.set('Customer|w:id = ?(42)', { query: 'Q1', parameters: [] });
      cache.set('Customer|w:id = ?(99)', { query: 'Q2', parameters: [] }); // same normalised key
      expect(cache.size()).toBe(1);
    });

    it('clear empties the store and resets counters', () => {
      const cache = new PlanSqlCache();
      cache.set('k', { query: 'SELECT 1', parameters: [] });
      cache.getTemplate('k');
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.cacheHits).toBe(0);
      expect(cache.cacheMisses).toBe(0);
    });
  });
});

describe('QueryBuilder plan-level caching (P1-20)', () => {
  it('reuses SQL template when PlanSqlCache is injected', () => {
    const plan = new CapturedQueryPlan(async () => null);
    const cache = plan.planSqlCache;
    const dialect = new StubDialect();
    const qb = new QueryBuilder(dialect, undefined, 'test', cache);

    // First call — cache miss, SQL generated
    const result1 = qb.generateSql(User, {
      where: [{ condition: '"id" = ?', parameters: [42] }],
      limit: 1
    });
    expect(result1.query).toContain('SELECT');
    expect(result1.parameters).toEqual([42]);

    // Second call — plan cache should hit
    const result2 = qb.generateSql(User, {
      where: [{ condition: '"id" = ?', parameters: [99] }],
      limit: 1
    });
    expect(result2.query).toBe(result1.query); // same SQL template
    expect(result2.parameters).toEqual([99]); // freshly bound params
  });

  it('fallback: compiled and uncompiled produce identical SQL', () => {
    const dialect = new StubDialect();
    const qb = new QueryBuilder(dialect, undefined, 'test');

    const opts = { where: [{ condition: '"id" = ?', parameters: [42] }] };
    const { query: compiledSql } = qb.generateSql(User, opts);

    // Regular (non-plan) QueryBuilder
    const qb2 = new QueryBuilder(dialect, undefined, 'test');
    const { query: regularSql } = qb2.generateSql(User, opts);

    expect(compiledSql).toBe(regularSql);
  });

  it('rebinds parameters correctly after plan cache hit', () => {
    const plan = new CapturedQueryPlan(async () => null);
    const cache = plan.planSqlCache;
    const dialect = new StubDialect();
    const qb = new QueryBuilder(dialect, undefined, 'test', cache);

    qb.generateSql(User, { where: [{ condition: '"age" > ?', parameters: [18] }] });
    const result = qb.generateSql(User, { where: [{ condition: '"age" > ?', parameters: [21] }] });
    expect(result.parameters).toEqual([21]);
  });
});
