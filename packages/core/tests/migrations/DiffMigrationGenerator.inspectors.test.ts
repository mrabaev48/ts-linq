import { DiffMigrationGenerator } from '../../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { ColumnMetadata, SqlParameter } from '../../src/types';
import { DatabaseProvider } from '../../src/DatabaseProvider';

class FakeProvider extends DatabaseProvider {
  constructor(
    public label: 'postgresql' | 'mysql' | 'mssql',
    private responses: Array<{ like: RegExp; rows: unknown[] }>
  ) {
    super('');
    this.providerName = label;
  }
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): any {
    return {};
  }
  public async insert<T extends object>(entity: T): Promise<T> {
    return entity;
  }
  public async update<T extends object>(entity: T): Promise<T> {
    return entity;
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
  protected async doExecuteQuery<T>(sql: string, _params?: readonly SqlParameter[]): Promise<T[]> {
    const hit = this.responses.find((r) => r.like.test(sql));
    return (hit?.rows as T[]) || [];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
}

function registerUsers(withIndex: {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
}) {
  class User {}
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'Users');
  const cols: ColumnMetadata[] = [
    {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    } as unknown as ColumnMetadata,
    {
      propertyName: 'active',
      columnName: 'active',
      type: 'BOOLEAN',
      nullable: false
    } as unknown as ColumnMetadata,
    {
      propertyName: 'email',
      columnName: 'email',
      type: 'TEXT',
      nullable: false
    } as unknown as ColumnMetadata
  ];
  cols.forEach((c) => MetadataStorage.addColumn(User, c));
  MetadataStorage.addPrimaryKey(User, 'id');
  MetadataStorage.addIndex(User, {
    name: withIndex.name,
    columns: withIndex.columns,
    unique: withIndex.unique,
    where: withIndex.where
  } as any);
}

test('DiffMigrationGenerator uses Postgres inspector to create missing filtered index', async () => {
  registerUsers({
    name: 'idx_users_active',
    columns: ['active'],
    unique: false,
    where: 'active = true'
  });
  const provider = new FakeProvider('postgresql', [
    { like: /FROM\s+pg_indexes/i, rows: [] }
  ]) as unknown as DatabaseProvider;
  const gen = new DiffMigrationGenerator(provider);
  const steps = await gen.generate();
  const up = steps.map((s) => s.sql).join('\n');
  expect(up).toContain('CREATE INDEX');
  expect(up).toContain('WHERE active = true');
});

test('DiffMigrationGenerator uses MySQL inspector to create missing index (ignores WHERE)', async () => {
  registerUsers({
    name: 'idx_users_active',
    columns: ['active'],
    unique: false,
    where: 'active = 1'
  });
  const provider = new FakeProvider('mysql', [
    { like: /FROM\s+information_schema\.statistics/i, rows: [] }
  ]) as unknown as DatabaseProvider;
  const gen = new DiffMigrationGenerator(provider);
  const steps = await gen.generate();
  const up = steps.map((s) => s.sql).join('\n');
  expect(up).toContain('CREATE INDEX');
  expect(up).not.toContain('WHERE active = 1');
});

test('DiffMigrationGenerator uses MSSQL inspector to create missing filtered index', async () => {
  registerUsers({
    name: 'idx_users_active',
    columns: ['active'],
    unique: false,
    where: 'active = 1'
  });
  const provider = new FakeProvider('mssql', [
    { like: /FROM\s+sys\.indexes/i, rows: [] },
    { like: /FROM\s+sys\.index_columns/i, rows: [] }
  ]) as unknown as DatabaseProvider;
  const gen = new DiffMigrationGenerator(provider);
  const steps = await gen.generate();
  const up = steps.map((s) => s.sql).join('\n');
  expect(up).toContain('CREATE INDEX');
  expect(up).toContain('WHERE active = 1');
});
