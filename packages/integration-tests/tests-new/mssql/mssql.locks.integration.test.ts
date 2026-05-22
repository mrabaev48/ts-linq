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
        "IF OBJECT_ID(N'dbo.items_lock', N'U') IS NOT NULL DROP TABLE [dbo].[items_lock]"
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
        [lockedId]
      );
      // Pin p2 to a single physical connection via a transaction so that SET LOCK_TIMEOUT
      // applies to the same connection that runs the UPDATE.
      // NOWAIT in the UPDATE hint makes SQL Server fail immediately if the row is locked
      // rather than waiting for the default 0 (indefinite) timeout.
      await p2.beginTransaction();
      let p2Error: Error | undefined;
      try {
        await p2.executeNonQuery('SET LOCK_TIMEOUT 100');
        await p2.executeNonQuery(
          'UPDATE t SET t.[name]=t.[name] FROM [dbo].[items_lock] AS t WITH (ROWLOCK, UPDLOCK, NOWAIT) WHERE t.[id]=@p1',
          [lockedId as unknown as never]
        );
      } catch (err) {
        p2Error = err as Error;
      } finally {
        try {
          await p2.rollbackTransaction();
        } catch {}
      }
      expect(p2Error).toBeInstanceOf(DatabaseError);
      await p1.rollbackTransaction();
    } finally {
      try {
        await p1.executeNonQuery(
          "IF OBJECT_ID(N'dbo.items_lock', N'U') IS NOT NULL DROP TABLE [dbo].[items_lock]"
        );
      } catch {}
    }
  });
});
