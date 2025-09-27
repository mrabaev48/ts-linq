import { PostgresProvider } from '@ts-linq/postgres';
import { MySqlProvider } from '@ts-linq/mysql';
import { MssqlProvider } from '@ts-linq/mssql';

const PG = process.env.POSTGRES_URL || '';
const MY = process.env.MYSQL_URL || '';
const MS = process.env.MSSQL_URL || '';

const pgD = PG ? describe : describe.skip;
const myD = MY ? describe : describe.skip;
const msD = MS ? describe : describe.skip;

pgD('[integration][types][pg] DECIMAL/UUID/date', () => {
  test('DECIMAL precision/scale, UUID, TIMESTAMP', async () => {
    const p = new PostgresProvider(PG);
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "edge_types"');
      await p.executeNonQuery('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await p.executeNonQuery('CREATE TABLE "edge_types"(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), amount DECIMAL(10,2) NOT NULL, created_at TIMESTAMP NOT NULL)');
      await p.executeNonQuery('INSERT INTO "edge_types"(amount, created_at) VALUES($1, $2)', ['1234.56' as unknown as never, new Date('2020-01-02T03:04:05Z') as unknown as never]);
      const rows = await p.executeQuery<{ amount: string; created_at: Date }>('SELECT amount::text AS amount, created_at FROM "edge_types"');
      expect(rows[0].amount).toBe('1234.56');
      expect(new Date(rows[0].created_at).toISOString()).toBe('2020-01-02T03:04:05.000Z');
    } finally {
      try { await p.executeNonQuery('DROP TABLE IF EXISTS "edge_types"'); } catch {}
    }
  });
});

myD('[integration][types][mysql] DECIMAL/date', () => {
  test('DECIMAL precision/scale and DATETIME', async () => {
    const p = new MySqlProvider(MY);
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS `edge_types`');
      await p.executeNonQuery('CREATE TABLE `edge_types`(id INT PRIMARY KEY, amount DECIMAL(10,2) NOT NULL, created_at DATETIME NOT NULL)');
      await p.executeNonQuery('INSERT INTO `edge_types`(id, amount, created_at) VALUES(1, ?, ?)', ['1234.56' as unknown as never, '2020-01-02 03:04:05' as unknown as never]);
      const rows = await p.executeQuery<{ amount: string; created_at: Date }>('SELECT amount, created_at FROM `edge_types`');
      expect(rows[0].amount).toBe('1234.56');
    } finally {
      try { await p.executeNonQuery('DROP TABLE IF EXISTS `edge_types`'); } catch {}
    }
  });
});

msD('[integration][types][mssql] DECIMAL/date', () => {
  test('DECIMAL precision/scale and DATETIME2', async () => {
    const p = new MssqlProvider(MS);
    await p.connect();
    try {
      await p.executeNonQuery('IF OBJECT_ID(N"dbo.edge_types", N"U") IS NOT NULL DROP TABLE [dbo].[edge_types]');
      await p.executeNonQuery('CREATE TABLE [dbo].[edge_types]([id] INT PRIMARY KEY, [amount] DECIMAL(10,2) NOT NULL, [created_at] DATETIME2 NOT NULL)');
      await p.executeNonQuery('INSERT INTO [dbo].[edge_types]([id],[amount],[created_at]) VALUES(@p1,@p2,@p3)', [1 as unknown as never, '1234.56' as unknown as never, '2020-01-02 03:04:05' as unknown as never]);
      const rows = await p.executeQuery<{ amount: string; created_at: Date }>('SELECT [amount], [created_at] FROM [dbo].[edge_types]');
      expect(rows[0].amount).toBe('1234.56');
    } finally {
      try { await p.executeNonQuery('IF OBJECT_ID(N"dbo.edge_types", N"U") IS NOT NULL DROP TABLE [dbo].[edge_types]'); } catch {}
    }
  });
});


