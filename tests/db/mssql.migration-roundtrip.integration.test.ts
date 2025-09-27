import { DiffMigrationGenerator, MetadataStorage } from '@ts-linq/core';
import { MssqlProvider } from '@ts-linq/mssql';

const url = process.env.MSSQL_URL || '';
const d = url ? describe : describe.skip;

class RUserMs { id!: number; email!: string }

d('[integration][mssql] migration round-trip (diff → apply → no diff)', () => {
  test('DiffMigrationGenerator produces empty diff after applying SQL', async () => {
    const p = new MssqlProvider(url);
    await p.connect();
    try {
      await p.executeNonQuery('IF OBJECT_ID(N"dbo.rt_users", N"U") IS NOT NULL DROP TABLE [dbo].[rt_users]');

      MetadataStorage.getInstance().clear();
      MetadataStorage.addEntity(RUserMs, 'rt_users');
      MetadataStorage.addColumn(RUserMs, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false });
      MetadataStorage.addColumn(RUserMs, { propertyName: 'email', columnName: 'email', type: 'TEXT', nullable: false });
      MetadataStorage.addPrimaryKey(RUserMs, 'id');

      const gen1 = new DiffMigrationGenerator(p as any);
      const steps1 = await gen1.generate();
      expect(steps1.length).toBeGreaterThan(0);
      for (const s of steps1) await p.executeNonQuery(s.sql);

      const gen2 = new DiffMigrationGenerator(p as any);
      const steps2 = await gen2.generate();
      expect(steps2.length).toBe(0);
    } finally {
      try { await p.executeNonQuery('IF OBJECT_ID(N"dbo.rt_users", N"U") IS NOT NULL DROP TABLE [dbo].[rt_users]'); } catch {}
    }
  });
});


