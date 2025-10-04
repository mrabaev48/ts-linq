import { MssqlProvider } from '@ts-linq/provider-mssql';

const MS = process.env.MSSQL_URL || '';
const d = MS ? describe : describe.skip;

d('[integration][types][mssql] DECIMAL/DATETIME2', () => {
  test('DECIMAL precision/scale and DATETIME2', async () => {
    const p = new MssqlProvider(MS);
    await p.connect();
    try {
      await p.executeNonQuery(
        'IF OBJECT_ID(N"dbo.edge_types", N"U") IS NOT NULL DROP TABLE [dbo].[edge_types]'
      );
      await p.executeNonQuery(
        'CREATE TABLE [dbo].[edge_types]([id] INT PRIMARY KEY, [amount] DECIMAL(10,2) NOT NULL, [created_at] DATETIME2 NOT NULL)'
      );
      await p.executeNonQuery(
        'INSERT INTO [dbo].[edge_types]([id],[amount],[created_at]) VALUES(@p1, @p2, @p3)',
        [1 as unknown as never, '1234.56' as unknown as never, '2020-01-02 03:04:05' as unknown as never]
      );
      const rows = await p.executeQuery<{ amount: string; created_at: string }>(
        'SELECT CONVERT(varchar(20), [amount]) as amount, CONVERT(varchar(19), [created_at], 120) as created_at FROM [dbo].[edge_types]'
      );
      expect(rows[0].amount).toBe('1234.56');
      expect(rows[0].created_at).toBe('2020-01-02 03:04:05');
    } finally {
      try {
        await p.executeNonQuery(
          'IF OBJECT_ID(N"dbo.edge_types", N"U") IS NOT NULL DROP TABLE [dbo].[edge_types]'
        );
      } catch {}
    }
  });
});


