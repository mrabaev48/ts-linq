import { DiffMigrationGenerator, MetadataStorage } from '@ts-linq/core';
import { MySqlProvider } from '@ts-linq/mysql';

const url = process.env.MYSQL_URL || '';
const d = url ? describe : describe.skip;

class RUserMy { id!: number; email!: string }

d('[integration][mysql] migration round-trip (diff → apply → no diff)', () => {
  test('DiffMigrationGenerator produces empty diff after applying SQL', async () => {
    const p = new MySqlProvider(url);
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS `rt_users`');

      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(RUserMy, 'rt_users');
      MetadataStorage.addColumn(RUserMy, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
      MetadataStorage.addColumn(RUserMy, { propertyName: 'email', columnName: 'email', type: 'TEXT', nullable: false });
      MetadataStorage.addPrimaryKey(RUserMy, 'id');

      const gen1 = new DiffMigrationGenerator(p as any);
      const steps1 = await gen1.generate();
      expect(steps1.length).toBeGreaterThan(0);
      for (const s of steps1) await p.executeNonQuery(s.sql);

      const gen2 = new DiffMigrationGenerator(p as any);
      const steps2 = await gen2.generate();
      expect(steps2.length).toBe(0);
    } finally {
      try { await p.executeNonQuery('DROP TABLE IF EXISTS `rt_users`'); } catch {}
    }
  });
});


