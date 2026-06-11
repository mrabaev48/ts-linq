import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { QueryContext } from '@ts-linq/query/internal';
import type { QueryOptions, SqlDialect, SqlParameter, WhereClause } from '@ts-linq/types';

import { Queryable } from '../src/Queryable';

/**
 * End-to-end regression for the silent-wrong-results bug (query/task-4): a `.where()` predicate
 * comparing a converted column (`HasConversion`) against a literal must emit the CONVERTED value
 * as the bound parameter, not the raw model value. Before task-4 the bare `new SqlVisitor()`
 * dropped the converterResolver, so the raw literal leaked into the query.
 */
class ConvUser {
  id!: number;
  active!: boolean;
}

const boolToInt = {
  toProvider: (v: unknown) => (v ? 1 : 0),
  fromProvider: (v: unknown) => v === 1
};

/** Dialect that surfaces WHERE params into the result so the test can observe them. */
class CapturingDialect implements SqlDialect {
  public buildSelect(
    entityClass: new () => unknown,
    options: QueryOptions
  ): { query: string; parameters: SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const parameters: SqlParameter[] = [];
    const wheres: WhereClause[] = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : [];
    let query = `SELECT * FROM ${meta.tableName}`;
    if (wheres.length) {
      query += ' WHERE ' + wheres.map((w) => w.condition).join(' AND ');
      for (const w of wheres) parameters.push(...(w.parameters as SqlParameter[]));
    }
    return { query, parameters };
  }
  public quoteIdentifier(id: string): string {
    return `"${id}"`;
  }
}

class CapturingProvider extends DatabaseProvider {
  public lastParams: readonly SqlParameter[] = [];
  private readonly dialect = new CapturingDialect();
  public constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    (this as unknown as { providerName: string }).providerName = 'test';
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
  protected async doExecuteQuery<T>(_sql: string, params?: readonly SqlParameter[]): Promise<T[]> {
    this.lastParams = params ?? [];
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 1;
  }
}

function registerConvUser(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(ConvUser, 'conv_users');
  MetadataStorage.addColumn(ConvUser, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    primaryKey: true
  });
  MetadataStorage.addColumn(ConvUser, {
    propertyName: 'active',
    columnName: 'active',
    type: 'INTEGER',
    converter: boolToInt
  });
}

describe('Converter lifting in .where() (end-to-end via Queryable)', () => {
  beforeEach(registerConvUser);

  test('a converted-column predicate binds the CONVERTED literal (true → 1)', async () => {
    const provider = new CapturingProvider();
    const q = new Queryable(ConvUser, QueryContext.fromProvider(provider)).whereCompiled({
      ast: {
        type: 'binary',
        operator: '===',
        left: { type: 'property', name: 'active' },
        right: { type: 'literal', value: true }
      },
      parameters: []
    });
    await q.toArray();
    expect(provider.lastParams).toEqual([1]);
  });
});
