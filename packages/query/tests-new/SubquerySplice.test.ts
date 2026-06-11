import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { QueryContext } from '@ts-linq/query/internal';
import type { QueryOptions, SqlDialect, SqlParameter } from '@ts-linq/types';

import { Queryable } from '../src/Queryable';

class User {
  id!: number;
  name!: string;
}

class Post {
  id!: number;
  userId!: number;
}

/**
 * A dialect that renders WHERE clauses and renumbers placeholders globally to `$N`
 * (Postgres-style). This is exactly the behaviour that exposes a subquery param-ordering
 * bug: a spliced subquery is rendered by its own dialect pass and would arrive pre-numbered.
 */
class RenumberingDialect implements SqlDialect {
  public buildSelect<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass) || { tableName: entityClass.name };
    const whereArr = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : [];
    const params: SqlParameter[] = [];
    let sql = `SELECT * FROM ${meta.tableName}`;
    if (whereArr.length) {
      const conds = whereArr
        .map((w) => {
          params.push(...w.parameters);
          return w.condition;
        })
        .join(' AND ');
      sql += ` WHERE ${conds}`;
    }
    let i = 0;
    sql = sql.replace(/\?/g, () => `$${++i}`);
    return { query: sql, parameters: params };
  }

  public quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}

class TestProvider extends DatabaseProvider {
  private readonly dialect = new RenumberingDialect();
  public override async connect(): Promise<void> {}
  public override async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return this.dialect;
  }
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
  protected async doExecuteQuery<T>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 1;
  }
  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}
  public constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    (this as unknown as { providerName: string }).providerName = 'test';
  }
}

function registerMetadata(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'users');
  MetadataStorage.addColumn(User, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
  MetadataStorage.addEntity(Post, 'posts');
  MetadataStorage.addColumn(Post, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
  // userId maps to a different column name to exercise resolution.
  MetadataStorage.addColumn(Post, {
    propertyName: 'userId',
    columnName: 'user_id',
    type: 'INTEGER'
  });
}

function renderModel<T>(q: Queryable<T>): {
  query: string;
  parameters: readonly SqlParameter[];
} {
  const internals = q as unknown as {
    _sqlBuilder: {
      generateFromModel: (
        entity: new () => unknown,
        model: unknown
      ) => { query: string; parameters: readonly SqlParameter[] };
    };
    _model: unknown;
    _entityClass: new () => unknown;
  };
  return internals._sqlBuilder.generateFromModel(internals._entityClass, internals._model);
}

describe('Queryable subquery splice (task-6)', () => {
  beforeEach(() => {
    registerMetadata();
  });

  it('whereInSubquery resolves the property key to its mapped column and quotes it', () => {
    const provider = new TestProvider();
    const sub = new Queryable(Post, QueryContext.fromProvider(provider)).whereIn('id', [1]);
    const q = new Queryable(Post, QueryContext.fromProvider(provider)).whereInSubquery(
      'userId',
      sub
    );

    const clause = (q as unknown as { _model: { where: Array<{ condition: string }> } })._model
      .where[0];
    // `userId` → column `user_id`, quoted with the dialect — not the raw property key.
    expect(clause.condition.startsWith('"user_id" IN (')).toBe(true);
    expect(clause.condition).not.toContain('userId');
  });

  it('aligns outer + subquery parameters after global ?→$N renumbering (whereInSubquery)', () => {
    const provider = new TestProvider();
    const sub = new Queryable(Post, QueryContext.fromProvider(provider)).whereIn('id', [777]);
    const q = new Queryable(User, QueryContext.fromProvider(provider))
      .whereIn('id', [111])
      .whereInSubquery('id', sub);

    const { query, parameters } = renderModel(q);

    // Outer placeholder must be $1, subquery placeholder $2 — distinct and in order.
    expect(query).toContain('"id" IN ($1)');
    expect(query).toContain('"id" IN ($2)');
    expect(parameters).toEqual([111, 777]);
  });

  it('aligns outer + subquery parameters for whereExists', () => {
    const provider = new TestProvider();
    const sub = new Queryable(Post, QueryContext.fromProvider(provider)).whereIn('id', [555]);
    const q = new Queryable(User, QueryContext.fromProvider(provider))
      .whereIn('id', [222])
      .whereExists(sub);

    const { query, parameters } = renderModel(q);

    expect(query).toContain('"id" IN ($1)');
    expect(query).toContain('EXISTS (');
    expect(query).toContain('"id" IN ($2)');
    expect(parameters).toEqual([222, 555]);
  });
});
