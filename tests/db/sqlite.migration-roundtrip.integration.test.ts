import { DiffMigrationGenerator, MetadataStorage } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';

class RUserSq {
  id!: number;
  email!: string;
}

describe('[integration][sqlite] migration round-trip (diff → apply → no diff)', () => {
  test('DiffMigrationGenerator produces empty diff after applying SQL (baseline features)', async () => {
    const p = new SQLiteProvider(':memory:');
    await p.connect();
    // Expected schema via MetadataStorage
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(RUserSq, 'rt_users');
    MetadataStorage.addColumn(RUserSq, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(RUserSq, {
      propertyName: 'email',
      columnName: 'email',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(RUserSq, 'id');

    const gen1 = new DiffMigrationGenerator(p as any);
    const steps1 = await gen1.generate();
    expect(steps1.length).toBeGreaterThan(0);
    for (const s of steps1) await p.executeNonQuery(s.sql);

    const gen2 = new DiffMigrationGenerator(p as any);
    const steps2 = await gen2.generate();
    expect(steps2.length).toBe(0);
  });
});
