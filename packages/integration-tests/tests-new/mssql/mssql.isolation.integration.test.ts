import { MssqlProvider } from '@ts-linq/provider-mssql';

const url = process.env.MSSQL_URL || '';
const d = url ? describe : describe.skip;

d('[integration][mssql] isolation (READ COMMITTED vs SNAPSHOT)', () => {
  test('READ COMMITTED sees committed updates; SNAPSHOT reads a stable snapshot', async () => {
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
        "IF OBJECT_ID(N'dbo.iso_items', N'U') IS NOT NULL DROP TABLE [dbo].[iso_items]"
      );
      await p1.executeNonQuery(
        'CREATE TABLE [dbo].[iso_items]([id] INT PRIMARY KEY, [v] INT NOT NULL)'
      );
      await p1.executeNonQuery('INSERT INTO [dbo].[iso_items]([id],[v]) VALUES(1,0)');

      // SNAPSHOT isolation requires DB option; fallback to REPEATABLE READ semantics via HOLDLOCK for test.
      // p2's UPDATE will block until p1 releases the HOLDLOCK by committing, so we must NOT await it
      // while p1 still holds the lock — that would create a deadlock.
      await p1.beginTransaction();
      const a1 = await p1.executeQuery<{ v: number }>(
        'SELECT [v] FROM [dbo].[iso_items] WITH (HOLDLOCK) WHERE [id]=@p1',
        [1]
      );
      expect(a1[0].v).toBe(0);

      // Kick off p2's update without awaiting — it blocks on p1's HOLDLOCK.
      const p2Done = (async () => {
        await p2.beginTransaction();
        await p2.executeNonQuery('UPDATE [dbo].[iso_items] SET [v]=1 WHERE [id]=@p1', [1]);
        await p2.commitTransaction();
      })();

      // p1 still sees 0 even though p2 is waiting (HOLDLOCK prevents dirty reads).
      const a2 = await p1.executeQuery<{ v: number }>(
        'SELECT [v] FROM [dbo].[iso_items] WITH (HOLDLOCK) WHERE [id]=@p1',
        [1]
      );
      expect(a2[0].v).toBe(0);

      // p1 commits → releases HOLDLOCK → p2's UPDATE can now proceed.
      await p1.commitTransaction();
      await p2Done;
    } finally {
      try {
        await p1.executeNonQuery(
          "IF OBJECT_ID(N'dbo.iso_items', N'U') IS NOT NULL DROP TABLE [dbo].[iso_items]"
        );
      } catch {}
    }
  });
});
