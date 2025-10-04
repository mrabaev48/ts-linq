import { MssqlProvider } from '@ts-linq/provider-mssql';

const url = process.env.MSSQL_URL || '';
const d = url ? describe : describe.skip;

d('[integration][mssql] upsert (MERGE)', () => {
  test('insert then update same key via MERGE', async () => {
    const p = new MssqlProvider(url);
    await p.connect();
    try {
      await p.executeNonQuery('IF OBJECT_ID(N"dbo.up_items", N"U") IS NOT NULL DROP TABLE [dbo].[up_items]');
      await p.executeNonQuery('CREATE TABLE [dbo].[up_items]([id] INT PRIMARY KEY, [name] NVARCHAR(100) NOT NULL)');

      await p.executeNonQuery(
        'MERGE [dbo].[up_items] AS t USING (SELECT @p1 as id, @p2 as name) AS s ON (t.id = s.id) WHEN MATCHED THEN UPDATE SET name = s.name WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);',
        [1 as unknown as never, 'a']
      );
      await p.executeNonQuery(
        'MERGE [dbo].[up_items] AS t USING (SELECT @p1 as id, @p2 as name) AS s ON (t.id = s.id) WHEN MATCHED THEN UPDATE SET name = s.name WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);',
        [1 as unknown as never, 'b']
      );
      const rows = await p.executeQuery<{ name: string }>('SELECT [name] FROM [dbo].[up_items] WHERE [id]=@p1', [1 as unknown as never]);
      expect(rows[0].name).toBe('b');
    } finally {
      try { await p.executeNonQuery('IF OBJECT_ID(N"dbo.up_items", N"U") IS NOT NULL DROP TABLE [dbo].[up_items]'); } catch {}
    }
  });
});


