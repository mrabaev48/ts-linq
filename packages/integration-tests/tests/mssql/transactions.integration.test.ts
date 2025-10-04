import { MssqlProvider } from '@ts-linq/provider-mssql';

const MS = process.env.MSSQL_URL || '';
const d = MS ? describe : describe.skip;

d('[integration][mssql] transactions', () => {
  test('commit persists, rollback reverts', async () => {
    const p = new MssqlProvider(MS);
    await p.connect();
    try {
      await p.executeNonQuery(
        'IF OBJECT_ID(N"dbo.tx_items", N"U") IS NULL CREATE TABLE [dbo].[tx_items]([id] INT IDENTITY(1,1) PRIMARY KEY, [name] NVARCHAR(50) NOT NULL)'
      );

      await p.beginTransaction();
      await p.executeNonQuery("INSERT INTO [dbo].[tx_items]([name]) VALUES(@p1)", ['a']);
      await p.commitTransaction();
      const afterCommit = await p.executeQuery<{ name: string }>('SELECT [name] FROM [dbo].[tx_items]');
      expect(afterCommit.length).toBe(1);

      await p.beginTransaction();
      await p.executeNonQuery("INSERT INTO [dbo].[tx_items]([name]) VALUES(@p1)", ['b']);
      await p.rollbackTransaction();
      const afterRollback = await p.executeQuery<{ name: string }>(
        "SELECT [name] FROM [dbo].[tx_items] WHERE [name]='b'"
      );
      expect(afterRollback.length).toBe(0);
    } finally {
      try {
        await p.executeNonQuery('IF OBJECT_ID(N"dbo.tx_items", N"U") IS NOT NULL DROP TABLE [dbo].[tx_items]');
      } catch {}
    }
  });
});


