import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Diff generator: indexes and foreign keys (SQLite path)', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  test('emits CREATE INDEX on create table', async () => {
    class A {}
    class B {}
    MetadataStorage.addEntity(A, 'A');
    MetadataStorage.addColumn(A, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    } as any);
    MetadataStorage.addPrimaryKey(A, 'id');
    // Secondary column with index
    MetadataStorage.addColumn(A, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: true
    } as any);
    MetadataStorage.addIndex(A, { name: 'idx_A_name', columns: ['name'], unique: false } as any);

    const provider = {
      providerLabel: 'sqlite',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    // Should include create table A and index for name
    expect(steps.some((s) => /CREATE TABLE IF NOT EXISTS A/.test(s.sql))).toBe(true);
    expect(
      steps.some((s) => /CREATE INDEX IF NOT EXISTS idx_A_name ON A \(name\)/.test(s.sql))
    ).toBe(true);
  });

  test('emits DROP/CREATE INDEX for existing table diff', async () => {
    class T {}
    MetadataStorage.addEntity(T, 'T');
    MetadataStorage.addColumn(T, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    } as any);
    MetadataStorage.addPrimaryKey(T, 'id');
    MetadataStorage.addColumn(T, {
      propertyName: 'x',
      columnName: 'x',
      type: 'INTEGER',
      nullable: true
    } as any);
    MetadataStorage.addIndex(T, { name: 'idx_T_x', columns: ['x'], unique: false } as any);

    const provider = {
      providerLabel: 'sqlite',
      executeQuery: async <T>(sql: string): Promise<T[]> => {
        if (sql.includes('sqlite_master') || sql.includes('PRAGMA table_info')) {
          // Pretend table exists with only id column; no indexes
          if (sql.startsWith('PRAGMA'))
            return [
              { name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 }
            ] as unknown as T[];
          return [{ name: 'T' }] as unknown as T[];
        }
        return [] as unknown as T[];
      },
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    expect(steps.some((s) => /CREATE INDEX IF NOT EXISTS idx_T_x ON T \(x\)/.test(s.sql))).toBe(
      true
    );
  });

  test('handles FK scenario for existing table (no-op for SQLite path)', async () => {
    class P {}
    class C {}
    // Parent table
    MetadataStorage.addEntity(P, 'P');
    MetadataStorage.addColumn(P, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    } as any);
    MetadataStorage.addPrimaryKey(P, 'id');
    // Child with FK to P(id)
    MetadataStorage.addEntity(C, 'C');
    MetadataStorage.addColumn(C, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    } as any);
    MetadataStorage.addPrimaryKey(C, 'id');
    MetadataStorage.addColumn(C, {
      propertyName: 'p_id',
      columnName: 'p_id',
      type: 'INTEGER',
      nullable: true
    } as any);

    // Подделаем actual snapshot через провайдера: таблица C уже есть, FK отсутствует
    const provider = {
      providerLabel: 'sqlite',
      executeQuery: async <T>(sql: string): Promise<T[]> => {
        if (sql.includes('sqlite_master')) {
          return [{ name: 'P' }, { name: 'C' }] as unknown as T[];
        }
        if (sql.startsWith('PRAGMA table_info(P)')) {
          return [
            { name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 }
          ] as unknown as T[];
        }
        if (sql.startsWith('PRAGMA table_info(C)')) {
          return [
            { name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
            { name: 'p_id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 }
          ] as unknown as T[];
        }
        return [] as unknown as T[];
      },
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    // Для SQLite изменение FK на существующей таблице требует rebuild, поэтому на данном этапе не эмитится.
    // Убеждаемся, что команды существуют, но ALTER TABLE ... ADD FOREIGN KEY для C отсутствует.
    expect(steps.some((s) => /CREATE TABLE IF NOT EXISTS P/.test(s.sql))).toBe(false);
    expect(steps.some((s) => /CREATE TABLE IF NOT EXISTS C/.test(s.sql))).toBe(false);
    expect(steps.some((s) => /ADD FOREIGN KEY/.test(s.sql))).toBe(false);
  });
});
