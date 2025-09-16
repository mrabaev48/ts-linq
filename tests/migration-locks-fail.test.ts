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
  public async up(): Promise<void> {}
  public async down(): Promise<void> {}
}

class PgLockFailProvider extends DatabaseProvider {
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
    if (/SELECT version, name, applied_at FROM __migrations/i.test(sql))
      return [] as unknown as T[];
    if (/SELECT pg_try_advisory_lock/i.test(sql)) return [{ locked: false }] as unknown as T[];
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
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

describe('MigrationRunner lock failures', () => {
  it('throws clear error when PG lock cannot be acquired', async () => {
    const p = new PgLockFailProvider();
    const r = new MigrationRunner(p);
    r.addMigration(new DummyMigration());
    await expect(r.migrate()).rejects.toThrow(/Failed to acquire migration lock/i);
  });
});
