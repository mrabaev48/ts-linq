import { DiffMigrationGenerator } from '@ts-linq/migrations';
import { MetadataStorage } from '@ts-linq/metadata';
import { MySqlProvider } from '@ts-linq/provider-mysql';

const url = process.env.MYSQL_URL || '';
const d = url ? describe : describe.skip;

class RUserMy {
  id!: number;
  email!: string;
}

d('[integration][mysql] migration round-trip (diff → apply → no diff)', () => {
  test('DiffMigrationGenerator produces empty diff after applying SQL', async () => {
    const p = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS `rt_users`');

      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(RUserMy, 'rt_users');
      MetadataStorage.addColumn(RUserMy, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      });
      MetadataStorage.addColumn(RUserMy, {
        propertyName: 'email',
        columnName: 'email',
        type: 'TEXT',
        nullable: false
      });
      MetadataStorage.addPrimaryKey(RUserMy, 'id');

      const gen1 = new DiffMigrationGenerator(p as any);
      const steps1 = await gen1.generate();
      expect(steps1.length).toBeGreaterThan(0);
      for (const s of steps1) await p.executeNonQuery(s.sql);

      const gen2 = new DiffMigrationGenerator(p as any);
      const steps2 = await gen2.generate();
      expect(steps2.length).toBe(0);
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS `rt_users`');
      } catch {}
    }
  });
});
