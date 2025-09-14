import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Diff generator: unique constraints', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  test('PG: emits ADD CONSTRAINT UNIQUE on create and existing table', async () => {
    class U {}
    MetadataStorage.addEntity(U, 'U');
    MetadataStorage.addColumn(U, { propertyName: 'a', columnName: 'a', type: 'INTEGER', nullable: false } as any);
    MetadataStorage.addColumn(U, { propertyName: 'b', columnName: 'b', type: 'INTEGER', nullable: false } as any);
    MetadataStorage.addPrimaryKey(U, 'a');
    MetadataStorage.addIndex(U, { name: 'ux_U_a_b', columns: ['a', 'b'], unique: true } as any);

    // Create path
    const providerCreate = { providerLabel: 'postgresql', executeQuery: async () => [], executeNonQuery: async () => 0 } as unknown as DatabaseProvider;
    const genCreate = new DiffMigrationGenerator(providerCreate);
    const stepsCreate = await genCreate.generate();
    expect(stepsCreate.some((s) => /ALTER TABLE U ADD CONSTRAINT ux_U_a_b UNIQUE \(a, b\)/.test(s.sql))).toBe(true);

    // Existing table path (no unique in actual) → should add unique
    const providerExisting = {
      providerLabel: 'postgresql',
      executeQuery: async <R>(sql: string): Promise<R[]> => {
        if (sql.includes('information_schema.tables')) return [{ table_name: 'U' }] as unknown as R[];
        if (sql.includes('information_schema.columns')) return [
          { column_name: 'a', data_type: 'int', is_nullable: 'NO', column_default: null },
          { column_name: 'b', data_type: 'int', is_nullable: 'NO', column_default: null }
        ] as unknown as R[];
        if (sql.includes('table_constraints')) return [] as unknown as R[]; // no PK/unique info considered
        return [] as unknown as R[];
      },
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const genExist = new DiffMigrationGenerator(providerExisting);
    const stepsExist = await genExist.generate();
    expect(stepsExist.some((s) => /ALTER TABLE U ADD CONSTRAINT ux_U_a_b UNIQUE \(a, b\)/.test(s.sql))).toBe(true);
  });
});


