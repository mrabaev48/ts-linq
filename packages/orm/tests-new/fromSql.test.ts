import 'reflect-metadata';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { MysqlDialect } from '@ts-linq/dialect-mysql';
import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { Column, Entity, MetadataStorage, PrimaryKey } from '@ts-linq/metadata';
import { Queryable } from '@ts-linq/query';
import type { QueryOptions } from '@ts-linq/types';

import { ChangeTracker } from '../src/ChangeTracker';
import { DatabaseFacade } from '../src/DatabaseFacade';
import { DbSet } from '../src/DbSet';
import { interpolatedToRaw, sql, SqlInterpolated, toSqlParam } from '../src/sql/sqlTag';

// ─── Test entity ──────────────────────────────────────────────────────────────

@Entity({ name: 'users' })
class User {
  @PrimaryKey()
  @Column()
  id!: number;

  @Column()
  name!: string;

  @Column()
  age!: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockProvider(overrides: Record<string, unknown> = {}) {
  return {
    findById: jest.fn(),
    findWhereIn: jest.fn(),
    query: jest.fn(),
    execute: jest.fn(),
    executeTransaction: jest.fn(),
    rawQuery: jest.fn(),
    executeNonQuery: jest.fn<() => Promise<number>>().mockResolvedValue(5),
    formatSqlWithParams: jest.fn((rawSql: string, params: unknown[]) => ({ sql: rawSql, params })),
    providerLabel: 'MockProvider',
    loggerRef: undefined,
    getDialect: jest
      .fn()
      .mockReturnValue({ parameterStyle: 0, quoteIdentifier: (s: string) => `"${s}"` }),
    ...overrides
  } as any;
}

// ─── sql tagged template ──────────────────────────────────────────────────────

describe('sql tagged template', () => {
  it('creates SqlInterpolated with correct fragments and values', () => {
    const id = 42;
    const name = 'Alice';
    const result = sql`SELECT * FROM users WHERE id = ${id} AND name = ${name}`;

    expect(result).toBeInstanceOf(SqlInterpolated);
    expect(result.fragments).toEqual(['SELECT * FROM users WHERE id = ', ' AND name = ', '']);
    expect(result.values).toEqual([42, 'Alice']);
  });

  it('handles template with no interpolations', () => {
    const result = sql`SELECT * FROM users`;

    expect(result.fragments).toEqual(['SELECT * FROM users']);
    expect(result.values).toEqual([]);
  });

  it('handles single interpolation', () => {
    const val = 99;
    const result = sql`SELECT ${val}`;

    expect(result.fragments).toEqual(['SELECT ', '']);
    expect(result.values).toEqual([99]);
  });
});

// ─── interpolatedToRaw ────────────────────────────────────────────────────────

describe('interpolatedToRaw', () => {
  it('produces correct ?-style SQL and params array', () => {
    const id = 10;
    const active = true;
    const { sql: rawSql, params } = interpolatedToRaw(
      sql`SELECT * FROM users WHERE id = ${id} AND active = ${active}`
    );

    expect(rawSql).toBe('SELECT * FROM users WHERE id = ? AND active = ?');
    expect(params).toEqual([10, true]);
  });

  it('handles null / undefined as null', () => {
    const { params } = interpolatedToRaw(sql`WHERE x = ${null} AND y = ${undefined}`);
    expect(params).toEqual([null, null]);
  });

  it('converts Date to Date (not string)', () => {
    const d = new Date('2024-01-01');
    const { params } = interpolatedToRaw(sql`WHERE ts = ${d}`);
    expect(params[0]).toBeInstanceOf(Date);
  });

  it('converts unknown objects via String()', () => {
    const obj = { toString: () => 'custom' };
    const { params } = interpolatedToRaw(sql`WHERE x = ${obj}`);
    expect(params[0]).toBe('custom');
  });

  it('empty template returns empty sql and params', () => {
    const { sql: rawSql, params } = interpolatedToRaw(sql``);
    expect(rawSql).toBe('');
    expect(params).toEqual([]);
  });
});

// ─── toSqlParam helper ────────────────────────────────────────────────────────

describe('toSqlParam', () => {
  it('passes through string, number, boolean, Date, Uint8Array', () => {
    const cases = ['hello', 42, true, new Date(), new Uint8Array([1, 2])];
    for (const v of cases) {
      expect(toSqlParam(v)).toBe(v);
    }
  });

  it('converts null/undefined to null', () => {
    expect(toSqlParam(null)).toBeNull();
    expect(toSqlParam(undefined)).toBeNull();
  });
});

// ─── DbSet.fromSqlInterpolated / fromSqlRaw ───────────────────────────────────

describe('DbSet raw SQL entry points', () => {
  let dbSet: DbSet<User>;
  let changeTracker: ChangeTracker;

  beforeEach(() => {
    changeTracker = new ChangeTracker();
    const provider = makeMockProvider();
    dbSet = new DbSet(User, { provider, changeTracker });
  });

  describe('fromSqlInterpolated()', () => {
    it('returns a Queryable', () => {
      const q = dbSet.fromSqlInterpolated(sql`SELECT * FROM users WHERE id = ${1}`);
      expect(q).toBeInstanceOf(Queryable);
    });

    it('sets rawSqlSource with correct sql and params', () => {
      const q = dbSet.fromSqlInterpolated(
        sql`SELECT * FROM users WHERE id = ${5} AND name = ${'Alice'}`
      );
      const model = (q as any)._model;
      expect(model.rawSqlSource).toBeDefined();
      expect(model.rawSqlSource.sql).toBe('SELECT * FROM users WHERE id = ? AND name = ?');
      expect(model.rawSqlSource.params).toEqual([5, 'Alice']);
    });

    it('returns a fresh Queryable (does not mutate DbSet state)', () => {
      const q1 = dbSet.fromSqlInterpolated(sql`SELECT 1`);
      const q2 = dbSet.fromSqlInterpolated(sql`SELECT 2`);
      expect((q1 as any)._model).not.toBe((q2 as any)._model);
    });
  });

  describe('fromSqlRaw()', () => {
    it('returns a Queryable with rawSqlSource', () => {
      const q = dbSet.fromSqlRaw('SELECT * FROM users WHERE id = ?', 7);
      const model = (q as any)._model;
      expect(model.rawSqlSource).toBeDefined();
      expect(model.rawSqlSource.sql).toBe('SELECT * FROM users WHERE id = ?');
      expect(model.rawSqlSource.params).toEqual([7]);
    });

    it('handles multiple parameters', () => {
      const q = dbSet.fromSqlRaw('SELECT * FROM users WHERE id = ? AND age > ?', 1, 18);
      const model = (q as any)._model;
      expect(model.rawSqlSource.params).toEqual([1, 18]);
    });
  });
});

// ─── Dialect: buildSelect with rawSqlSource ───────────────────────────────────

describe('Dialect buildSelect with rawSqlSource', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(User, 'users');
    MetadataStorage.addColumn(User, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(User, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addColumn(User, {
      propertyName: 'age',
      columnName: 'age',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(User, 'id');
  });

  const rawOpts: QueryOptions = {
    rawSqlSource: {
      sql: 'SELECT * FROM users WHERE tenant_id = ?',
      params: [42]
    }
  };

  describe('PostgresDialect', () => {
    it('wraps raw SQL as derived table FROM (...) AS t0', () => {
      const dialect = new PostgresDialect();
      const { query } = dialect.buildSelect(User, rawOpts, undefined);
      expect(query).toContain('FROM (SELECT * FROM users WHERE tenant_id = $1) AS t0');
    });

    it('raw SQL params come first; WHERE params get subsequent $N indices', () => {
      const dialect = new PostgresDialect();
      const opts: QueryOptions = {
        rawSqlSource: {
          sql: 'SELECT * FROM users WHERE tenant_id = ?',
          params: [99]
        },
        where: [{ condition: 'age > ?', parameters: [18] }]
      };
      const { query, parameters } = dialect.buildSelect(User, opts, undefined);
      expect(query).toContain('$1');
      expect(query).toContain('$2');
      expect(parameters).toEqual([99, 18]);
    });

    it('generates valid SQL without WHERE when no extra filters', () => {
      const dialect = new PostgresDialect();
      const { query, parameters } = dialect.buildSelect(User, rawOpts, undefined);
      expect(query).toContain('SELECT');
      expect(parameters).toEqual([42]);
    });
  });

  describe('MysqlDialect', () => {
    it('wraps raw SQL as derived table FROM (...) AS t0', () => {
      const dialect = new MysqlDialect();
      const { query } = dialect.buildSelect(User, rawOpts, undefined);
      expect(query).toContain('FROM (SELECT * FROM users WHERE tenant_id = ?) AS t0');
    });

    it('preserves ? placeholders for MySQL', () => {
      const dialect = new MysqlDialect();
      const opts: QueryOptions = {
        rawSqlSource: {
          sql: 'SELECT * FROM users WHERE tenant_id = ?',
          params: [99]
        },
        where: [{ condition: 'age > ?', parameters: [18] }]
      };
      const { query, parameters } = dialect.buildSelect(User, opts, undefined);
      expect(query).toContain('WHERE age > ?');
      expect(parameters).toEqual([99, 18]);
    });
  });

  describe('MssqlDialect', () => {
    it('wraps raw SQL as derived table FROM (...) AS t0', () => {
      const dialect = new MssqlDialect();
      const { query } = dialect.buildSelect(User, rawOpts, undefined);
      expect(query).toContain('FROM (SELECT * FROM users WHERE tenant_id = @p1) AS t0');
    });

    it('raw SQL params come first; WHERE params get subsequent @pN indices', () => {
      const dialect = new MssqlDialect();
      const opts: QueryOptions = {
        rawSqlSource: {
          sql: 'SELECT * FROM users WHERE tenant_id = ?',
          params: [99]
        },
        where: [{ condition: 'age > ?', parameters: [18] }]
      };
      const { query, parameters } = dialect.buildSelect(User, opts, undefined);
      expect(query).toContain('@p1');
      expect(query).toContain('@p2');
      expect(parameters).toEqual([99, 18]);
    });
  });
});

// ─── DatabaseFacade ───────────────────────────────────────────────────────────

describe('DatabaseFacade', () => {
  let mockProvider: ReturnType<typeof makeMockProvider>;
  let facade: DatabaseFacade;
  let changeTracker: ChangeTracker;

  beforeEach(() => {
    changeTracker = new ChangeTracker();
    mockProvider = makeMockProvider();
    const context = {
      provider: mockProvider,
      changeTracker,
      entityLoader: undefined
    };
    facade = new DatabaseFacade(context as any);
  });

  describe('executeSqlInterpolated()', () => {
    it('calls formatSqlWithParams and executeNonQuery with correct args', async () => {
      const tenantId = 5;
      mockProvider.formatSqlWithParams.mockReturnValue({
        sql: 'DELETE FROM sessions WHERE tenant_id = $1',
        params: [tenantId]
      });

      await facade.executeSqlInterpolated(sql`DELETE FROM sessions WHERE tenant_id = ${tenantId}`);

      expect(mockProvider.formatSqlWithParams).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE tenant_id = ?',
        [tenantId]
      );
      expect(mockProvider.executeNonQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE tenant_id = $1',
        [tenantId]
      );
    });

    it('returns the affected row count from executeNonQuery', async () => {
      mockProvider.executeNonQuery.mockResolvedValue(3);
      mockProvider.formatSqlWithParams.mockReturnValue({
        sql: 'DELETE FROM t WHERE 1=1',
        params: []
      });

      const result = await facade.executeSqlInterpolated(sql`DELETE FROM t WHERE 1=1`);
      expect(result).toBe(3);
    });
  });

  describe('executeSqlRaw()', () => {
    it('calls executeNonQuery with formatted sql and params', async () => {
      mockProvider.formatSqlWithParams.mockReturnValue({
        sql: 'UPDATE t SET x = $1 WHERE id = $2',
        params: [1, 2]
      });

      await facade.executeSqlRaw('UPDATE t SET x = ? WHERE id = ?', 1, 2);

      expect(mockProvider.formatSqlWithParams).toHaveBeenCalledWith(
        'UPDATE t SET x = ? WHERE id = ?',
        [1, 2]
      );
      expect(mockProvider.executeNonQuery).toHaveBeenCalled();
    });
  });

  describe('sqlQuery()', () => {
    it('returns a Queryable with rawSqlSource set', () => {
      const q = facade.sqlQuery(sql`SELECT * FROM users WHERE active = ${true}`, User);
      expect(q).toBeInstanceOf(Queryable);
      const model = (q as any)._model;
      expect(model.rawSqlSource).toBeDefined();
      expect(model.rawSqlSource.sql).toBe('SELECT * FROM users WHERE active = ?');
      expect(model.rawSqlSource.params).toEqual([true]);
    });
  });

  describe('sqlQueryRaw()', () => {
    it('returns a Queryable with rawSqlSource set', () => {
      const q = facade.sqlQueryRaw('SELECT * FROM users WHERE id = ?', User, 42);
      const model = (q as any)._model;
      expect(model.rawSqlSource).toBeDefined();
      expect(model.rawSqlSource.sql).toBe('SELECT * FROM users WHERE id = ?');
      expect(model.rawSqlSource.params).toEqual([42]);
    });
  });
});
