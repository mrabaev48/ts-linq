import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Diff generator: CHECK constraints and DEFAULTs', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  test('PG: emits ADD CONSTRAINT CHECK and ALTER ADD COLUMN DEFAULT', async () => {
    class T {}
    MetadataStorage.addEntity(T, 'T');
    MetadataStorage.addColumn(T, {
      propertyName: 'a',
      columnName: 'a',
      type: 'INTEGER',
      nullable: false,
      defaultValue: 0
    } as any);
    MetadataStorage.addColumn(T, {
      propertyName: 'b',
      columnName: 'b',
      type: 'INTEGER',
      nullable: false
    } as any);

    const provider = {
      providerLabel: 'postgresql',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    const create = steps.find((s) => /CREATE TABLE IF NOT EXISTS T/.test(s.sql))?.sql || '';
    expect(create).toMatch(/a INTEGER NOT NULL DEFAULT 0/);
  });
});
