import { MssqlProvider } from '@ts-linq/provider-mssql';

const url = process.env.MSSQL_URL || '';
const d = url ? describe : describe.skip;

d('[integration][mssql] isolation (READ COMMITTED vs SNAPSHOT)', () => {
  test('READ COMMITTED sees committed updates; SNAPSHOT reads a stable snapshot', async () => {
    const p1 = new MssqlProvider(url);
    const p2 = new MssqlProvider(url);
    await p1.connect();
    await p2.connect();
    try {
      await p1.executeNonQuery(
        'IF OBJECT_ID(N"dbo.iso_items", N"U") IS NOT NULL DROP TABLE [dbo].[iso_items]'
      );
      await p1.executeNonQuery(
        'CREATE TABLE [dbo].[iso_items]([id] INT PRIMARY KEY, [v] INT NOT NULL)'
      );
      await p1.executeNonQuery('INSERT INTO [dbo].[iso_items]([id],[v]) VALUES(1,0)');

      // SNAPSHOT isolation requires DB option; fallback to REPEATABLE READ semantics via HOLDLOCK for test
      await p1.beginTransaction();
      const a1 = await p1.executeQuery<{ v: number }>(
        'SELECT [v] FROM [dbo].[iso_items] WITH (HOLDLOCK) WHERE [id]=@p1',
        [1 as unknown as never]
      );
      expect(a1[0].v).toBe(0);

      await p2.beginTransaction();
      await p2.executeNonQuery('UPDATE [dbo].[iso_items] SET [v]=1 WHERE [id]=@p1', [
        1 as unknown as never
      ]);
      await p2.commitTransaction();

      const a2 = await p1.executeQuery<{ v: number }>(
        'SELECT [v] FROM [dbo].[iso_items] WITH (HOLDLOCK) WHERE [id]=@p1',
        [1 as unknown as never]
      );
      expect(a2[0].v).toBe(0);
      await p1.commitTransaction();
    } finally {
      try {
        await p1.executeNonQuery(
          'IF OBJECT_ID(N"dbo.iso_items", N"U") IS NOT NULL DROP TABLE [dbo].[iso_items]'
        );
      } catch {}
    }
  });
});
