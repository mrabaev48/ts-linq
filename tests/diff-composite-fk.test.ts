import { DiffMigrationGenerator } from '../src/migrations/DiffMigrationGenerator';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import type { DatabaseProvider } from '../src/providers/DatabaseProvider';

describe('Diff generator: composite foreign keys', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  function defineCompositeSchema() {
    class P {}
    class C {}
    // Parent with composite PK (id1, id2)
    MetadataStorage.addEntity(P, 'P');
    MetadataStorage.addColumn(P, { propertyName: 'id1', columnName: 'id1', type: 'INTEGER', nullable: false } as any);
    MetadataStorage.addColumn(P, { propertyName: 'id2', columnName: 'id2', type: 'INTEGER', nullable: false } as any);
    MetadataStorage.addPrimaryKey(P, 'id1');
    MetadataStorage.addPrimaryKey(P, 'id2');

    // Child with composite FK (p1, p2) -> P(id1, id2)
    MetadataStorage.addEntity(C, 'C');
    MetadataStorage.addColumn(C, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false } as any);
    MetadataStorage.addPrimaryKey(C, 'id');
    MetadataStorage.addColumn(C, { propertyName: 'p1', columnName: 'p1', type: 'INTEGER', nullable: true } as any);
    MetadataStorage.addColumn(C, { propertyName: 'p2', columnName: 'p2', type: 'INTEGER', nullable: true } as any);
    MetadataStorage.addRelationship(C, {
      propertyName: 'p',
      type: 'many-to-one',
      targetEntity: P,
      foreignKeys: ['p1', 'p2'],
      referencedColumns: ['id1', 'id2'],
      cascade: true
    } as any);
  }

  test('SQLite: inline FOREIGN KEY (p1, p2) in CREATE TABLE', async () => {
    defineCompositeSchema();
    const provider = {
      providerLabel: 'sqlite',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    expect(steps.some((s) => /CREATE TABLE IF NOT EXISTS C/.test(s.sql))).toBe(true);
    expect(steps.some((s) => /FOREIGN KEY \(p1, p2\) REFERENCES P \(id1, id2\) ON DELETE CASCADE ON UPDATE CASCADE/.test(s.sql))).toBe(true);
  });

  test('Postgres: ALTER TABLE ADD CONSTRAINT with composite columns', async () => {
    defineCompositeSchema();
    const provider = {
      providerLabel: 'postgresql',
      executeQuery: async () => [],
      executeNonQuery: async () => 0
    } as unknown as DatabaseProvider;
    const gen = new DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    const alter = steps.find((s) => /ALTER TABLE C ADD CONSTRAINT/.test(s.sql));
    expect(alter).toBeTruthy();
    expect(alter!.sql).toMatch(/FOREIGN KEY \(p1, p2\) REFERENCES P \(id1, id2\)/);
  });
});


