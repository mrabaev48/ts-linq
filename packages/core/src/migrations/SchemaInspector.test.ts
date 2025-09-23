import { DatabaseProvider } from '../DatabaseProvider';
import type { SqlParameter } from '../types';
import { PostgresSchemaInspector, MySqlSchemaInspector, MssqlSchemaInspector } from './SchemaInspector';

class FakeProvider extends DatabaseProvider {
  private responses: Array<{ sqlLike: RegExp; rows: unknown[] }>;
  constructor(responses: Array<{ sqlLike: RegExp; rows: unknown[] }>) {
    super('');
    this.responses = responses;
  }
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): any { return {}; }
  public async insert<T extends object>(entity: T): Promise<T> { return entity; }
  public async update<T extends object>(entity: T): Promise<T> { return entity; }
  public async delete<T extends object>(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> { return null; }
  public async findAll<T extends object>(): Promise<T[]> { return []; }
  public async findWhere<T extends object>(): Promise<T[]> { return []; }
  public async findWhereIn<T extends object>(): Promise<T[]> { return []; }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  protected async doExecuteQuery<T>(sql: string, _params?: readonly SqlParameter[]): Promise<T[]> {
    const hit = this.responses.find(r => r.sqlLike.test(sql));
    return (hit?.rows as T[]) || [];
  }
  protected async doExecuteNonQuery(): Promise<number> { return 0; }
}

test('PostgresSchemaInspector.getIndexes parses unique, columns and where', async () => {
  const provider = new FakeProvider([
    {
      sqlLike: /FROM\s+pg_indexes/i,
      rows: [
        { indexname: 'idx_users_active', indexdef: 'CREATE INDEX idx_users_active ON public."Users" ("active") WHERE (active = true)' },
        { indexname: 'idx_users_lower_email', indexdef: 'CREATE UNIQUE INDEX idx_users_lower_email ON public."Users" (LOWER((email)))' }
      ]
    }
  ]) as unknown as DatabaseProvider;
  const ins = new PostgresSchemaInspector(provider);
  const idx = await ins.getIndexes('Users');
  expect(idx.find(i => i.name === 'idx_users_active')?.where ?? '').toContain('active');
  expect(idx.find(i => i.name === 'idx_users_lower_email')?.unique).toBe(true);
  expect(idx[0].columns).toContain('active');
});

test('MySqlSchemaInspector.getIndexes aggregates by name and preserves column order', async () => {
  const provider = new FakeProvider([
    {
      sqlLike: /FROM\s+information_schema\.statistics/i,
      rows: [
        { INDEX_NAME: 'idx_users_email', NON_UNIQUE: 0, COLUMN_NAME: 'email', SEQ_IN_INDEX: 1, COLLATION: 'A', EXPRESSION: null },
        { INDEX_NAME: 'idx_users_email', NON_UNIQUE: 0, COLUMN_NAME: null, SEQ_IN_INDEX: 2, COLLATION: 'A', EXPRESSION: 'LOWER(`email`)' }
      ]
    }
  ]) as unknown as DatabaseProvider;
  const ins = new MySqlSchemaInspector(provider);
  const idx = await ins.getIndexes('Users');
  expect(idx[0].name).toBe('idx_users_email');
  expect(idx[0].unique).toBe(true);
  expect(idx[0].columns).toEqual(['email']);
});

test('MssqlSchemaInspector.getIndexes returns where and columns', async () => {
  const provider = new FakeProvider([
    {
      sqlLike: /sys\.index_columns/i,
      rows: [
        { index_name: 'idx_users_active', column_name: 'active', key_ordinal: 1, is_descending_key: 0 }
      ]
    },
    {
      sqlLike: /FROM\s+sys\.indexes/i,
      rows: [
        { name: 'idx_users_active', is_unique: 0, filter_definition: '([active]=(1))' }
      ]
    }
  ]) as unknown as DatabaseProvider;
  const ins = new MssqlSchemaInspector(provider);
  const idx = await ins.getIndexes('Users');
  expect(idx[0].name).toBe('idx_users_active');
  expect(idx[0].where).toContain('active');
  const cols = idx.find(i => i.name === 'idx_users_active')?.columns ?? [];
  expect(cols).toEqual(['active']);
});


