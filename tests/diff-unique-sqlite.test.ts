import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Diff generator: unique constraints in SQLite via unique indexes', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  test('emits CREATE UNIQUE INDEX when actual lacks it', async () => {
    class U {}
    MetadataStorage.addEntity(U, 'U');
    MetadataStorage.addColumn(U, {
      propertyName: 'a',
      columnName: 'a',
      type: 'INTEGER',
      nullable: false
    } as any);
    MetadataStorage.addColumn(U, {
      propertyName: 'b',
      columnName: 'b',
      type: 'INTEGER',
      nullable: false
    } as any);
    MetadataStorage.addPrimaryKey(U, 'a');
    MetadataStorage.addIndex(U, { name: 'ux_U_a_b', columns: ['a', 'b'], unique: true } as any);

    const provider = {
      providerLabel: 'sqlite',
      executeQuery: async <R>(sql: string): Promise<R[]> => {
        if (sql.includes('sqlite_master')) return [{ name: 'U' }] as unknown as R[];
        if (sql.startsWith('PRAGMA table_info(U)'))
          return [
            { name: 'a', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
            { name: 'b', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0 }
          ] as unknown as R[];
        if (sql.startsWith('PRAGMA index_list(U)')) return [] as unknown as R[];
        return [] as unknown as R[];
      },
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    // Используем CREATE UNIQUE INDEX как эквивалент уникального констрейнта
    expect(
      steps.some((s) => /CREATE UNIQUE INDEX IF NOT EXISTS ux_U_a_b ON U \(a, b\)/.test(s.sql))
    ).toBe(true);
  });
});
