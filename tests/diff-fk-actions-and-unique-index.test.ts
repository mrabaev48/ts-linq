import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Diff generator: FK actions and composite unique index', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  test('Postgres: FK with ON DELETE/ON UPDATE actions via relationship metadata', async () => {
    class P {}
    class C {}
    MetadataStorage.addEntity(P, 'Parent');
    MetadataStorage.addColumn(P, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false } as any);
    MetadataStorage.addPrimaryKey(P, 'id');

    MetadataStorage.addEntity(C, 'Child');
    MetadataStorage.addColumn(C, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false } as any);
    MetadataStorage.addPrimaryKey(C, 'id');
    MetadataStorage.addColumn(C, { propertyName: 'pid', columnName: 'pid', type: 'INTEGER', nullable: true } as any);
    MetadataStorage.addRelationship(C, {
      propertyName: 'parent',
      type: 'many-to-one',
      targetEntity: P,
      foreignKey: 'pid',
      onDelete: 'SET NULL',
      onUpdate: 'RESTRICT'
    } as any);

    const provider = {
      providerLabel: 'postgresql',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    const alter = steps.find((s) => /ALTER TABLE Child ADD CONSTRAINT/.test(s.sql));
    expect(alter).toBeTruthy();
    expect(alter!.sql).toContain('ON DELETE SET NULL');
    expect(alter!.sql).toContain('ON UPDATE RESTRICT');
  });

  test('SQLite: CREATE UNIQUE INDEX for composite unique index', async () => {
    class U {}
    MetadataStorage.addEntity(U, 'U');
    MetadataStorage.addColumn(U, { propertyName: 'a', columnName: 'a', type: 'INTEGER', nullable: false } as any);
    MetadataStorage.addColumn(U, { propertyName: 'b', columnName: 'b', type: 'INTEGER', nullable: false } as any);
    MetadataStorage.addPrimaryKey(U, 'a');
    MetadataStorage.addIndex(U, { name: 'ux_U_a_b', columns: ['a', 'b'], unique: true } as any);

    const provider = {
      providerLabel: 'sqlite',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    expect(steps.some((s) => /CREATE TABLE IF NOT EXISTS U/.test(s.sql))).toBe(true);
    expect(steps.some((s) => /CREATE UNIQUE INDEX IF NOT EXISTS ux_U_a_b ON U \(a, b\)/.test(s.sql))).toBe(true);
  });
});


