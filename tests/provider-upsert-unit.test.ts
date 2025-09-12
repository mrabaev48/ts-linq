import 'reflect-metadata';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Column } from '../src/decorators/Column';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { PostgresProvider } from '../src/providers/PostgresProvider';
import { MySqlProvider } from '../src/providers/MySqlProvider';
import { MssqlProvider } from '../src/providers/MssqlProvider';
import { SqlParameter } from '../src/types';

@Entity({ name: 'UpUsers' })
class UpUser {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT', nullable: false }) name!: string;
}

class FakePg extends PostgresProvider {
  public lastSql?: string;
  public lastParams?: SqlParameter[];
  public rowsToReturn: Array<Record<string, unknown>> = [{ id: 1, name: 'pg' }];
  public async connect() {
    /* no-op */
  }
  public async disconnect() {
    /* no-op */
  }
  protected async doExecuteQuery<T>(sql: string, params: readonly SqlParameter[] = []): Promise<T[]> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return this.rowsToReturn as unknown as T[];
  }
  protected async doExecuteNonQuery(sql: string, params: readonly SqlParameter[] = []): Promise<number> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return 1;
  }
}

class FakeMy extends MySqlProvider {
  public lastSql?: string;
  public lastParams?: SqlParameter[];
  public async connect() {
    /* no-op */
  }
  public async disconnect() {
    /* no-op */
  }
  protected async doExecuteQuery<T>(sql: string, params: readonly SqlParameter[] = []): Promise<T[]> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(sql: string, params: readonly SqlParameter[] = []): Promise<number> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return 1;
  }
}

class FakeMs extends MssqlProvider {
  public lastSql?: string;
  public lastParams?: SqlParameter[];
  public async connect() {
    /* no-op */
  }
  public async disconnect() {
    /* no-op */
  }
  protected async doExecuteQuery<T>(sql: string, params: readonly SqlParameter[] = []): Promise<T[]> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(sql: string, params: readonly SqlParameter[] = []): Promise<number> {
    this.lastSql = sql;
    this.lastParams = params as SqlParameter[];
    return 1;
  }
}

describe('Provider upsert SQL (unit)', () => {
  beforeEach(() => {
    new UpUser();
  });

  test('PostgresProvider generates ON CONFLICT DO UPDATE and returns row', async () => {
    const p = new FakePg('postgres://fake');
    const u = new UpUser();
    u.id = 10 as any;
    u.name = 'A';
    p.rowsToReturn = [{ id: 10, name: 'B' }];
    await p.upsert(u, UpUser);
    expect(p.lastSql).toMatch(/INSERT INTO "UpUsers"/);
    expect(p.lastSql).toMatch(/ON CONFLICT .* DO UPDATE SET/);
    expect(Array.isArray(p.lastParams)).toBe(true);
    expect((u as any).name).toBe('B');
  });

  test('MySqlProvider generates ON DUPLICATE KEY UPDATE', async () => {
    const p = new FakeMy('mysql://fake');
    const u = new UpUser();
    u.id = 11 as any;
    u.name = 'A';
    await p.upsert(u, UpUser);
    expect(p.lastSql).toMatch(/INSERT INTO UpUsers/);
    expect(p.lastSql).toMatch(/ON DUPLICATE KEY UPDATE/);
    expect(p.lastSql).toMatch(/\?/); // uses positional params
  });

  test('MssqlProvider generates MERGE statement', async () => {
    const p = new FakeMs('mssql://fake');
    const u = new UpUser();
    u.id = 12 as any;
    u.name = 'A';
    await p.upsert(u, UpUser);
    expect(p.lastSql).toMatch(/MERGE\s+UpUsers\s+AS\s+t/i);
    expect(p.lastSql).toMatch(/WHEN MATCHED THEN UPDATE SET/i);
    expect(p.lastSql).toMatch(/WHEN NOT MATCHED THEN INSERT/i);
  });
});
