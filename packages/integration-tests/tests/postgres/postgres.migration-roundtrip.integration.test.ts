import { MigrationBuilder, DiffMigrationGenerator, MetadataStorage } from '@ts-linq/core';
import { PostgresProvider } from '@ts-linq/provider-pg';

const url = process.env.POSTGRES_URL || '';
const d = url ? describe : describe.skip;

class RUser {
  id!: number;
  email!: string;
  createdAt!: Date;
}

d('[integration][postgres] migration round-trip (diff → apply → no diff)', () => {
  test('DiffMigrationGenerator produces empty diff after applying SQL', async () => {
    const p = new PostgresProvider(url);
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "rt_users"');

      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(RUser, 'rt_users');
      MetadataStorage.addColumn(RUser, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      });
      MetadataStorage.addColumn(RUser, {
        propertyName: 'email',
        columnName: 'email',
        type: 'TEXT',
        nullable: false
      });
      MetadataStorage.addColumn(RUser, {
        propertyName: 'createdAt',
        columnName: 'created_at',
        type: 'TIMESTAMP',
        nullable: false
      });
      MetadataStorage.addPrimaryKey(RUser, 'id');

      const gen1 = new DiffMigrationGenerator(p as any);
      const steps1 = await gen1.generate();
      expect(steps1.length).toBeGreaterThan(0);
      for (const s of steps1) await p.executeNonQuery(s.sql);

      const gen2 = new DiffMigrationGenerator(p as any);
      const steps2 = await gen2.generate();
      expect(steps2.length).toBe(0);
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS "rt_users"');
      } catch {}
    }
  });
});
