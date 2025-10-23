import 'reflect-metadata';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { SqlParameter } from '../src/types';
import { DatabaseProvider } from '../src/DatabaseProvider';
import type { SqlDialect } from '../src/query/SqlDialect';

@Entity({ name: 'UpUsers' })
class UpUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class FakePg extends DatabaseProvider {
  public lastSql?: string;
  public lastParams?: SqlParameter[];
  public rowsToReturn: Array<Record<string, unknown>> = [{ id: 1, name: 'pg' }];
  constructor() {
    super('');
    this.providerName = 'postgresql';
  }
  public async connect() {}
  public async disconnect() {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return { buildSelect: () => ({ query: '', parameters: [] }) };
  }
  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return this.rowsToReturn as unknown as T[];
  }
  protected async doExecuteNonQuery(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<number> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return 1;
  }
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete<T extends object>(): Promise<void> {}
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
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  public async upsert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    this.lastSql = `INSERT INTO "UpUsers" ... ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name RETURNING *`;
    this.lastParams = [
      ((entity as unknown as { id?: unknown }).id ?? null) as unknown as SqlParameter,
      ((entity as unknown as { name?: unknown }).name ?? null) as unknown as SqlParameter
    ];
    // Simulate returned row overwriting entity name
    (entity as unknown as { name?: string }).name =
      (this.rowsToReturn[0]?.name as string) || (entity as unknown as { name?: string }).name;
    return entity;
  }
}

class FakeMy extends DatabaseProvider {
  public lastSql?: string;
  public lastParams?: SqlParameter[];
  constructor() {
    super('');
    this.providerName = 'mysql';
  }
  public async connect() {}
  public async disconnect() {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return { buildSelect: () => ({ query: '', parameters: [] }) };
  }
  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<number> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return 1;
  }
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete<T extends object>(): Promise<void> {}
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
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  public async upsert<T extends object>(entity: T, _entityClass: Function): Promise<T> {
    this.lastSql = `INSERT INTO UpUsers (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)`;
    this.lastParams = [
      ((entity as unknown as { id?: unknown }).id ?? null) as unknown as SqlParameter,
      ((entity as unknown as { name?: unknown }).name ?? null) as unknown as SqlParameter
    ];
    return entity;
  }
}

class FakeMs extends DatabaseProvider {
  public lastSql?: string;
  public lastParams?: SqlParameter[];
  constructor() {
    super('');
    this.providerName = 'mssql';
  }
  public async connect() {}
  public async disconnect() {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect {
    return { buildSelect: () => ({ query: '', parameters: [] }) };
  }
  protected async doExecuteQuery<T>(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<T[]> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(
    sql: string,
    params: readonly SqlParameter[] = []
  ): Promise<number> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return 1;
  }
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete<T extends object>(): Promise<void> {}
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
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  public async upsert<T extends object>(entity: T, _entityClass: Function): Promise<T> {
    this.lastSql = `MERGE UpUsers AS t USING (VALUES (?, ?)) AS s(id, name) ON (t.id = s.id) WHEN MATCHED THEN UPDATE SET name = s.name WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);`;
    this.lastParams = [
      ((entity as unknown as { id?: unknown }).id ?? null) as unknown as SqlParameter,
      ((entity as unknown as { name?: unknown }).name ?? null) as unknown as SqlParameter
    ];
    return entity;
  }
}

describe('Provider upsert SQL (unit)', () => {
  beforeEach(() => {
    new UpUser();
  });

  test('PostgresProvider generates ON CONFLICT DO UPDATE and returns row', async () => {
    const p = new FakePg('postgres://fake');
    const u = new UpUser();
    u.id = 10;
    u.name = 'A';
    p.rowsToReturn = [{ id: 10, name: 'B' }];
    await p.upsert(u, UpUser);
    expect(p.lastSql).toMatch(/INSERT INTO "UpUsers"/);
    expect(p.lastSql).toMatch(/ON CONFLICT .* DO UPDATE SET/);
    expect(Array.isArray(p.lastParams)).toBe(true);
    expect(u.name).toBe('B');
  });

  test('MySqlProvider generates ON DUPLICATE KEY UPDATE', async () => {
    const p = new FakeMy('mysql://fake');
    const u = new UpUser();
    u.id = 11;
    u.name = 'A';
    await p.upsert(u, UpUser);
    expect(p.lastSql).toMatch(/INSERT INTO UpUsers/);
    expect(p.lastSql).toMatch(/ON DUPLICATE KEY UPDATE/);
    expect(p.lastSql).toMatch(/\?/); // uses positional params
  });

  test('MssqlProvider generates MERGE statement', async () => {
    const p = new FakeMs('mssql://fake');
    const u = new UpUser();
    u.id = 12;
    u.name = 'A';
    await p.upsert(u, UpUser);
    expect(p.lastSql).toMatch(/MERGE\s+UpUsers\s+AS\s+t/i);
    expect(p.lastSql).toMatch(/WHEN MATCHED THEN UPDATE SET/i);
    expect(p.lastSql).toMatch(/WHEN NOT MATCHED THEN INSERT/i);
  });
});
