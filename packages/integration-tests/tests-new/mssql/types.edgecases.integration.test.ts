import { MssqlProvider } from '@ts-linq/provider-mssql';

const MS = process.env.MSSQL_URL || '';
const d = MS ? describe : describe.skip;

d('[integration][types][mssql] DECIMAL/date', () => {
  test('DECIMAL precision/scale and DATETIME2', async () => {
    const p = new MssqlProvider({
      server: process.env.MSSQL_SERVER || 'localhost',
      port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT) : 1433,
      database: process.env.MSSQL_DB || 'test',
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD
    });
    await p.connect();
    try {
      await p.executeNonQuery(
        'IF OBJECT_ID(N"dbo.edge_types", N"U") IS NOT NULL DROP TABLE [dbo].[edge_types]'
      );
      await p.executeNonQuery(
        'CREATE TABLE [dbo].[edge_types]([id] INT PRIMARY KEY, [amount] DECIMAL(10,2) NOT NULL, [created_at] DATETIME2 NOT NULL)'
      );
      await p.executeNonQuery(
        'INSERT INTO [dbo].[edge_types]([id],[amount],[created_at]) VALUES(@p1,@p2,@p3)',
        [1, '1234.56', '2020-01-02 03:04:05']
      );
      const rows = await p.executeQuery<{ amount: string; created_at: Date }>(
        'SELECT [amount], [created_at] FROM [dbo].[edge_types]'
      );
      expect(rows[0].amount).toBe('1234.56');
    } finally {
      try {
        await p.executeNonQuery(
          'IF OBJECT_ID(N"dbo.edge_types", N"U") IS NOT NULL DROP TABLE [dbo].[edge_types]'
        );
      } catch {}
    }
  });
});
