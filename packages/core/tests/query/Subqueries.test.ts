import { Queryable } from '../../src/query/Queryable';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { SqlDialect } from '../../src/query/SqlDialect';
import type { SqlParameter } from '../../src/types';
import { DatabaseProvider } from '../../src/DatabaseProvider';

class User {
  id!: number;
  name!: string;
}
class Order {
  id!: number;
  userId!: number;
  amount!: number;
}

/** Minimal dialect that renders SELECT and WHERE clauses and collects parameters. */
const stubDialect: SqlDialect = {
  buildSelect: (ctor, opts) => {
    const select = opts.select?.length ? opts.select.join(', ') : '*';
    const meta = MetadataStorage.getEntity(ctor as Function);
    const table = meta?.tableName ?? 'unknown';
    let query = `SELECT ${select} FROM ${table}`;
    const parameters: SqlParameter[] = [];
    if (opts.where && opts.where.length) {
      query += ' WHERE ' + opts.where.map((w) => w.condition).join(' AND ');
      for (const w of opts.where) parameters.push(...w.parameters);
    }
    if (opts.selectParams?.length) parameters.push(...opts.selectParams);
    return { query, parameters };
  }
};

class ProviderStub extends DatabaseProvider {
  public lastQuery?: { sql: string; params: readonly SqlParameter[] };
  constructor() {
    super('');
    this.providerName = 'test';
  }
  public getDialect(): SqlDialect {
    return stubDialect;
  }
  protected async doExecuteQuery<T>(_sql: string, _params: readonly SqlParameter[]): Promise<T[]> {
    this.lastQuery = { sql: _sql, params: _params };
    return [] as T[];
  }
  protected async doExecuteNonQuery(
    _sql: string,
    _params: readonly SqlParameter[]
  ): Promise<number> {
    return 0;
  }
  public async connect(): Promise<void> {
    this.isConnected = true;
  }
  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }
  public async createTable(): Promise<void> {
    /* no-op */
  }
  public async insert<T extends object>(e: T, _cls: Function): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T, _cls: Function): Promise<T> {
    return e;
  }
  public async delete<T extends object>(_e: T, _cls: Function): Promise<void> {
    /* no-op */
  }
  public async findById<T extends object>(_id: unknown, _cls: new () => T): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(_cls: new () => T): Promise<T[]> {
    return [];
  }
  public async findWhere<T extends object>(
    _cls: new () => T,
    _cond: Record<string, unknown>
  ): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(
    _cls: new () => T,
    _col: string,
    _v: unknown[]
  ): Promise<T[]> {
    return [];
  }
  public async beginTransaction(): Promise<void> {
    this.inTransaction = true;
  }
  public async commitTransaction(): Promise<void> {
    this.inTransaction = false;
  }
  public async rollbackTransaction(): Promise<void> {
    this.inTransaction = false;
  }
}

describe('Subqueries & EXISTS', () => {
  let provider: ProviderStub;
  let users: Queryable<User>;
  let orders: Queryable<Order>;

  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    // users
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
    MetadataStorage.addPrimaryKey(User, 'id');
    // orders
    MetadataStorage.addEntity(Order, 'orders');
    MetadataStorage.addColumn(Order, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(Order, {
      propertyName: 'userId',
      columnName: 'userId',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(Order, {
      propertyName: 'amount',
      columnName: 'amount',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(Order, 'id');

    provider = new ProviderStub();
    users = new Queryable<User>(User, provider);
    orders = new Queryable<Order>(Order, provider);
  });

  test('whereExists embeds EXISTS (subquery) in WHERE', async () => {
    // simple EXISTS without correlation (correlation can be added in future API)
    const q = users.whereExists(orders);
    await q.toArray();
    expect(provider.lastQuery?.sql).toContain('WHERE EXISTS (SELECT');
    expect(provider.lastQuery?.sql).toContain('FROM orders');
  });

  test('whereInSubquery embeds IN (subquery) for a column', async () => {
    const q = users.whereInSubquery('id', orders);
    await q.toArray();
    expect(provider.lastQuery?.sql).toContain('WHERE id IN (SELECT');
    expect(provider.lastQuery?.sql).toContain('FROM orders');
  });
});
