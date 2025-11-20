import { DiffMigrationGenerator } from '@ts-linq/migrations';
import { MetadataStorage } from '@ts-linq/metadata';
import { PostgresProvider } from '@ts-linq/provider-postgres';

const url = process.env.POSTGRES_URL || '';
const d = url ? describe : describe.skip;

class RUser {
  id!: number;
  email!: string;
  createdAt!: Date;
}

d('[integration][postgres] migration round-trip (diff → apply → no diff)', () => {
  test('DiffMigrationGenerator produces empty diff after applying SQL', async () => {
    const p = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    await p.connect();
    try {
      // Ensure clean
      await p.executeNonQuery('DROP TABLE IF EXISTS "rt_users"');

      // Expected schema via MetadataStorage
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

      // 1) Generate diff
      const gen1 = new DiffMigrationGenerator(p as any);
      const steps1 = await gen1.generate();
      expect(steps1.length).toBeGreaterThan(0);
      // Apply
      for (const s of steps1) await p.executeNonQuery(s.sql);

      // 2) Generate again — should be empty
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
