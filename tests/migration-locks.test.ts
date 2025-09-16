import { MigrationRunner } from '../src/migrations/MigrationRunner';
import { Migration } from '../src/migrations/Migration';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';

class DummyMigration extends Migration {
  protected get name() {
    return 'M1';
  }
  protected get version() {
    return '20250101000000';
  }
  public async up(): Promise<void> {
    /* no-op */
  }
  public async down(): Promise<void> {
    /* no-op */
  }
}

class PgLockProvider extends DatabaseProvider {
  public executed: string[] = [];
  constructor() {
    super('');
    (this as any).providerName = 'postgresql';
  }
  async connect(): Promise<void> {
    this.isConnected = true;
  }
  async disconnect(): Promise<void> {
    this.isConnected = false;
  }
  async createTable(): Promise<void> {}
  async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  async delete<T extends object>(): Promise<void> {}
  async findById(): Promise<any> {
    return null;
  }
  async findAll(): Promise<any[]> {
    return [];
  }
  async findWhere(): Promise<any[]> {
    return [];
  }
  async findWhereIn(): Promise<any[]> {
    return [];
  }
  protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
    this.executed.push(sql);
    if (/SELECT version, name, applied_at FROM __migrations/i.test(sql))
      return [] as unknown as T[];
    if (/SELECT pg_try_advisory_lock/i.test(sql)) return [{ locked: true }] as unknown as T[];
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(sql: string): Promise<number> {
    this.executed.push(sql);
    return 1;
  }
  async beginTransaction(): Promise<void> {
    this.inTransaction = true;
  }
  async commitTransaction(): Promise<void> {
    this.inTransaction = false;
  }
  async rollbackTransaction(): Promise<void> {
    this.inTransaction = false;
  }
}

describe('MigrationRunner locks', () => {
  it('acquires and releases pg advisory lock', async () => {
    const p = new PgLockProvider();
    const r = new MigrationRunner(p);
    r.addMigration(new DummyMigration());
    await r.migrate();
    expect(p.executed.some((s) => /pg_try_advisory_lock/i.test(s))).toBeTruthy();
    expect(p.executed.some((s) => /pg_advisory_unlock/i.test(s))).toBeTruthy();
  });

  it('acquires and releases MySQL GET_LOCK', async () => {
    class MyProvider extends DatabaseProvider {
      public executed: string[] = [];
      constructor() {
        super('');
        (this as any).providerName = 'mysql';
      }
      async connect(): Promise<void> {
        this.isConnected = true;
      }
      async disconnect(): Promise<void> {
        this.isConnected = false;
      }
      async createTable(): Promise<void> {}
      async insert<T extends object>(e: T): Promise<T> {
        return e;
      }
      async update<T extends object>(e: T): Promise<T> {
        return e;
      }
      async delete<T extends object>(): Promise<void> {}
      async findById(): Promise<any> {
        return null;
      }
      async findAll(): Promise<any[]> {
        return [];
      }
      async findWhere(): Promise<any[]> {
        return [];
      }
      async findWhereIn(): Promise<any[]> {
        return [];
      }
      protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
        this.executed.push(sql);
        if (/SELECT version, name, applied_at FROM __migrations/i.test(sql))
          return [] as unknown as T[];
        if (/GET_LOCK\('/i.test(sql)) return [{ r: 1 }] as unknown as T[];
        return [] as unknown as T[];
      }
      protected async doExecuteNonQuery(sql: string): Promise<number> {
        this.executed.push(sql);
        return 1;
      }
      async beginTransaction(): Promise<void> {
        this.inTransaction = true;
      }
      async commitTransaction(): Promise<void> {
        this.inTransaction = false;
      }
      async rollbackTransaction(): Promise<void> {
        this.inTransaction = false;
      }
    }
    const p = new MyProvider();
    const r = new MigrationRunner(p);
    r.addMigration(new DummyMigration());
    await r.migrate();
    expect(p.executed.some((s) => /GET_LOCK\('tslinq_migrate'/i.test(s))).toBeTruthy();
    expect(p.executed.some((s) => /RELEASE_LOCK\('tslinq_migrate'\)/i.test(s))).toBeTruthy();
  });

  it('acquires and releases MSSQL sp_getapplock', async () => {
    class MsProvider extends DatabaseProvider {
      public executed: string[] = [];
      constructor() {
        super('');
        (this as any).providerName = 'mssql';
      }
      async connect(): Promise<void> {
        this.isConnected = true;
      }
      async disconnect(): Promise<void> {
        this.isConnected = false;
      }
      async createTable(): Promise<void> {}
      async insert<T extends object>(e: T): Promise<T> {
        return e;
      }
      async update<T extends object>(e: T): Promise<T> {
        return e;
      }
      async delete<T extends object>(): Promise<void> {}
      async findById(): Promise<any> {
        return null;
      }
      async findAll(): Promise<any[]> {
        return [];
      }
      async findWhere(): Promise<any[]> {
        return [];
      }
      async findWhereIn(): Promise<any[]> {
        return [];
      }
      protected async doExecuteQuery<T>(sql: string): Promise<T[]> {
        this.executed.push(sql);
        if (/SELECT version, name, applied_at FROM __migrations/i.test(sql))
          return [] as unknown as T[];
        if (/sp_getapplock/i.test(sql)) return [{ res: 0 }] as unknown as T[]; // 0 success
        return [] as unknown as T[];
      }
      protected async doExecuteNonQuery(sql: string): Promise<number> {
        this.executed.push(sql);
        return 1;
      }
      async beginTransaction(): Promise<void> {
        this.inTransaction = true;
      }
      async commitTransaction(): Promise<void> {
        this.inTransaction = false;
      }
      async rollbackTransaction(): Promise<void> {
        this.inTransaction = false;
      }
    }
    const p = new MsProvider();
    const r = new MigrationRunner(p);
    r.addMigration(new DummyMigration());
    await r.migrate();
    expect(p.executed.some((s) => /sp_getapplock/i.test(s))).toBeTruthy();
    expect(p.executed.some((s) => /sp_releaseapplock/i.test(s))).toBeTruthy();
  });
});
