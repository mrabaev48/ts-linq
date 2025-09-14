import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Diff generator for non-SQLite providers', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  function makeEntity() {
    class T {}
    MetadataStorage.addEntity(T, 'T');
    MetadataStorage.addColumn(T, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      defaultValue: undefined,
      isGenerated: true,
      length: undefined,
      precision: undefined,
      scale: undefined,
      isVersion: false
    } as any);
    MetadataStorage.addPrimaryKey(T, 'id');
  }

  test('postgres provider produces CREATE TABLE when schema empty', async () => {
    makeEntity();
    const provider = {
      providerLabel: 'postgresql',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    expect(steps.some((s) => /CREATE TABLE IF NOT EXISTS T/.test(s.sql))).toBe(true);
  });

  test('mysql provider produces CREATE TABLE when schema empty', async () => {
    makeEntity();
    const provider = {
      providerLabel: 'mysql',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    expect(steps.some((s) => /CREATE TABLE IF NOT EXISTS T/.test(s.sql))).toBe(true);
  });

  test('mssql provider produces CREATE TABLE when schema empty', async () => {
    makeEntity();
    const provider = {
      providerLabel: 'mssql',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    expect(steps.some((s) => /CREATE TABLE IF NOT EXISTS T/.test(s.sql))).toBe(true);
  });
});


