import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Diff generator: column rename triggers rebuild (SQLite)', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  test('rename old_name -> new_name: emits rebuild with INSERT for common columns', async () => {
    class T {}
    // Expected metadata: id, new_name
    MetadataStorage.addEntity(T, 'T');
    MetadataStorage.addColumn(T, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    } as any);
    MetadataStorage.addPrimaryKey(T, 'id');
    MetadataStorage.addColumn(T, {
      propertyName: 'new_name',
      columnName: 'new_name',
      type: 'TEXT',
      nullable: true
    } as any);

    // Actual DB snapshot (SQLite): id, old_name
    const provider = {
      providerLabel: 'sqlite',
      executeQuery: async <R>(sql: string): Promise<R[]> => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'T' }] as unknown as R[];
        }
        if (sql.startsWith('PRAGMA table_info(T)')) {
          return [
            { name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
            { name: 'old_name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
          ] as unknown as R[];
        }
        return [] as unknown as R[];
      },
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;

    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    // Should rebuild: create __new_T, insert common columns only (id), drop old, rename
    expect(steps.some((s) => /^CREATE TABLE IF NOT EXISTS __new_T /.test(s.sql))).toBe(true);
    expect(steps.some((s) => /INSERT INTO __new_T \(id\) SELECT id FROM T/.test(s.sql))).toBe(true);
    expect(steps.some((s) => /^DROP TABLE T$/.test(s.sql))).toBe(true);
    expect(steps.some((s) => /^ALTER TABLE __new_T RENAME TO T$/.test(s.sql))).toBe(true);
  });
});
