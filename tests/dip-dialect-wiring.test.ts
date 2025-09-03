import 'reflect-metadata';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { MySqlProvider } from '../src/providers/MySqlProvider';
import { PostgresProvider } from '../src/providers/PostgresProvider';
import { MssqlProvider } from '../src/providers/MssqlProvider';
import { SQLiteDialect } from '../src/query/SQLiteDialect';
import { MysqlDialect } from '../src/query/MysqlDialect';
import { PostgresDialect } from '../src/query/PostgresDialect';
import { MssqlDialect } from '../src/query/MssqlDialect';
import { SqlDialect } from '../src/query/SqlDialect';
import { Queryable } from '../src/query/Queryable';

class ProviderStub extends DatabaseProvider {
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public async insert<T>(entity: T): Promise<T> { return entity; }
  public async update<T>(entity: T): Promise<T> { return entity; }
  public async delete<T>(): Promise<void> {}
  public async findById<T>(): Promise<T | null> { return null; }
  public async findAll<T>(): Promise<T[]> { return []; }
  public async findWhere<T>(): Promise<T[]> { return []; }
  public async findWhereIn<T>(): Promise<T[]> { return []; }
  protected async doExecuteQuery<T>(_sql: string, _params?: any[]): Promise<T[]> { return []; }
  protected async doExecuteNonQuery(_sql: string, _params?: any[]): Promise<number> { return 0; }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
}

class DummyDialect implements SqlDialect {
  buildSelect(): { query: string; parameters: any[] } {
    return { query: 'SELECT /*DUMMY DIALECT*/ 1', parameters: [] };
  }
}

describe('DIP: provider → dialect wiring', () => {
  test('Concrete providers return their dialects', () => {
    const sqlite = new SQLiteProvider(':memory:');
    const mysql = new MySqlProvider('mysql://user:pass@localhost/db');
    const pg = new PostgresProvider('postgres://user:pass@localhost/db');
    const mssql = new MssqlProvider('mssql://user:pass@localhost/db');

    expect(sqlite.getDialect()).toBeInstanceOf(SQLiteDialect);
    expect(mysql.getDialect()).toBeInstanceOf(MysqlDialect);
    expect(pg.getDialect()).toBeInstanceOf(PostgresDialect);
    expect(mssql.getDialect()).toBeInstanceOf(MssqlDialect);
  });

  test('Base DatabaseProvider default getDialect returns SQLiteDialect', () => {
    const base = new ProviderStub('conn');
    expect(base.getDialect()).toBeInstanceOf(SQLiteDialect);
  });

  test('Queryable uses provider.getDialect()', async () => {
    class DummyProvider extends ProviderStub {
      public capturedSql: string | undefined;
      public getDialect(): SqlDialect { return new DummyDialect(); }
      protected async doExecuteQuery<T>(sql: string, _params?: any[]): Promise<T[]> {
        this.capturedSql = sql;
        return [] as any;
      }
    }

    class T {}
    const provider = new DummyProvider('conn');
    const q = new Queryable<T>(T as any, provider);
    await q.toArray();
    expect(provider.capturedSql).toContain('/*DUMMY DIALECT*/');
  });
});


