import type { ExpressionNode } from '@ts-linq/ast';
import { DatabaseProvider } from '@ts-linq/core';
import { PostgresDialect } from '@ts-linq/dialect-postgres';
import { MetadataStorage } from '@ts-linq/metadata';
import { Queryable } from '@ts-linq/query';
import { QueryContext } from '@ts-linq/query/internal';
import type { SqlDialect, SqlParameter } from '@ts-linq/types';

/**
 * query/task-4 regression: the `.where()` runtime path (`whereCompiled`) must wire the full
 * SqlVisitorOptions surface from the dialect. Before the fix the bare `new SqlVisitor()` had no
 * translators, so spatial / JSON-path / EF.functions predicates threw `UNSUPPORTED_*` even though
 * the real `PostgresDialect` ships those translators.
 *
 * These tests use the REAL PostgresDialect but no live connection — `whereCompiled` + `buildSelect`
 * are pure SQL-string building, so they run without Docker or the compile-time transformer.
 */
class SpatialCity {
  id!: number;
  location!: unknown;
  name!: string;
  profile!: unknown;
}

/** DB-free provider whose dialect is the real PostgresDialect; captures the generated SQL. */
class PgSqlCaptureProvider extends DatabaseProvider {
  public lastSql = '';
  private readonly dialect = new PostgresDialect();
  public constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    (this as unknown as { providerName: string }).providerName = 'pg-capture';
  }
  public getDialect(): SqlDialect {
    return this.dialect;
  }
  public override async connect(): Promise<void> {}
  public override async disconnect(): Promise<void> {}
  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
    this.lastSql = sql;
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 1;
  }
}

function registerSpatialCity(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(SpatialCity, 'cities');
  MetadataStorage.addColumn(SpatialCity, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    primaryKey: true
  });
  MetadataStorage.addColumn(SpatialCity, {
    propertyName: 'location',
    columnName: 'location',
    type: 'TEXT'
  });
  MetadataStorage.addColumn(SpatialCity, {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT'
  });
  MetadataStorage.addColumn(SpatialCity, {
    propertyName: 'profile',
    columnName: 'profile',
    type: 'TEXT'
  });
}

async function compiledSql(ast: ExpressionNode, parameters: SqlParameter[] = []): Promise<string> {
  const provider = new PgSqlCaptureProvider();
  const q = new Queryable(SpatialCity, QueryContext.fromProvider(provider)).whereCompiled({
    ast,
    parameters
  });
  await q.toArray();
  return provider.lastSql;
}

describe('[integration] PostgresDialect translators wired into .where() (query/task-4)', () => {
  beforeEach(registerSpatialCity);

  test('spatial predicate compiles to ST_* SQL instead of throwing UNSUPPORTED_METHOD', async () => {
    const ast: ExpressionNode = {
      type: 'binary',
      operator: '<',
      left: {
        type: 'method',
        method: 'distance',
        object: { type: 'property', name: 'location' },
        args: [{ type: 'literal', value: 'POINT(0 0)' }]
      },
      right: { type: 'literal', value: 1000 }
    };
    const sql = await compiledSql(ast, []);
    expect(sql).toContain('ST_Distance');
  });

  test('JSON-path predicate compiles to JSONB operators instead of throwing', async () => {
    const ast: ExpressionNode = {
      type: 'binary',
      operator: '===',
      left: { type: 'jsonPath', column: 'profile', path: ['city'] },
      right: { type: 'literal', value: 'NYC' }
    };
    const sql = await compiledSql(ast, []);
    expect(sql).toContain("->>'city'");
  });

  test('EF.functions predicate compiles to dialect SQL instead of throwing', async () => {
    const ast: ExpressionNode = {
      type: 'efFunction',
      fn: 'like',
      args: [
        { type: 'property', name: 'name' },
        { type: 'literal', value: '%berlin%' }
      ]
    };
    const sql = await compiledSql(ast, []);
    expect(sql).toContain('LIKE');
  });
});
