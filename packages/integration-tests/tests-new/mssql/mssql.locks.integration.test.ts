import { MssqlProvider } from '@ts-linq/provider-mssql';
import { DatabaseError } from '@ts-linq/types';
const url = process.env.MSSQL_URL || '';
const d = url ? describe : describe.skip;

d('[integration][mssql] locks (UPDLOCK/HOLDLOCK)', () => {
  test('UPDLOCK + NOWAIT analogue: throws when row locked', async () => {
    const p1 = new MssqlProvider({
      server: process.env.MSSQL_SERVER || 'localhost',
      port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT) : 1433,
      database: process.env.MSSQL_DB || 'test',
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD
    });
    const p2 = new MssqlProvider({
      server: process.env.MSSQL_SERVER || 'localhost',
      port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT) : 1433,
      database: process.env.MSSQL_DB || 'test',
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD
    });
    await p1.connect();
    await p2.connect();
    try {
      await p1.executeNonQuery(
        'IF OBJECT_ID(N"dbo.items_lock", N"U") IS NOT NULL DROP TABLE [dbo].[items_lock]'
      );
      await p1.executeNonQuery(
        'CREATE TABLE [dbo].[items_lock]([id] INT IDENTITY(1,1) PRIMARY KEY, [name] NVARCHAR(255) NOT NULL)'
      );
      await p1.executeNonQuery("INSERT INTO [dbo].[items_lock]([name]) VALUES('a'),('b')");
      await p1.beginTransaction();
      const rows = await p1.executeQuery<{ id: number }>(
        'SELECT TOP(1) [id] FROM [dbo].[items_lock] ORDER BY [id]'
      );
      const lockedId = rows[0].id;
      await p1.executeNonQuery(
        'SELECT [id] FROM [dbo].[items_lock] WITH (UPDLOCK, HOLDLOCK) WHERE [id]=@p1',
        [lockedId as unknown as never]
      );
      await expect(
        p2.executeNonQuery('UPDATE [dbo].[items_lock] SET [name]=[name] WHERE [id]=@p1', [
          lockedId as unknown as never
        ])
      ).rejects.toBeInstanceOf(DatabaseError);
      await p1.rollbackTransaction();
    } finally {
      try {
        await p1.executeNonQuery(
          'IF OBJECT_ID(N"dbo.items_lock", N"U") IS NOT NULL DROP TABLE [dbo].[items_lock]'
        );
      } catch {}
    }
  });
});
