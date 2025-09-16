import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Diff generator: expression and partial indexes (Postgres)', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  test('creates expression index and partial index on PG', async () => {
    class E {}
    MetadataStorage.addEntity(E, 'E');
    MetadataStorage.addColumn(E, {
      propertyName: 'a',
      columnName: 'a',
      type: 'INTEGER',
      nullable: false
    } as any);
    MetadataStorage.addColumn(E, {
      propertyName: 'b',
      columnName: 'b',
      type: 'INTEGER',
      nullable: false
    } as any);
    MetadataStorage.addPrimaryKey(E, 'a');
    MetadataStorage.addIndex(E, {
      name: 'ix_expr',
      columns: [],
      unique: false,
      expression: '(LOWER((b)::text))'
    } as any);
    MetadataStorage.addIndex(E, {
      name: 'ix_partial',
      columns: ['a'],
      unique: false,
      where: 'a > 10'
    } as any);

    const provider = {
      providerLabel: 'postgresql',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    const expr = steps.find(
      (s) =>
        /CREATE INDEX IF NOT EXISTS ix_expr ON E \(LOWER\(\(b\)::text\)\)/.test(s.sql) ||
        /CREATE INDEX IF NOT EXISTS ix_expr ON E LOWER\(\(b\)::text\)/.test(s.sql)
    );
    expect(expr).toBeTruthy();
    const part = steps.find((s) =>
      /CREATE INDEX IF NOT EXISTS ix_partial ON E \(a\) WHERE a > 10/.test(s.sql)
    );
    expect(part).toBeTruthy();
  });
});
