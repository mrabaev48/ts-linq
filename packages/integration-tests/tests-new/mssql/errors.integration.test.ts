import { MssqlProvider } from '@ts-linq/provider-mssql';
import { ForeignKeyConstraintError, UniqueConstraintError } from '@ts-linq/types';

const MS = process.env.MSSQL_URL || '';
const msD = MS ? describe : describe.skip;

// Provider-scoped on purpose: this file exercises ONLY MSSQL so its `parent`/`child`
// DDL never races the identically-named tables driven by the postgres/mysql error suites
// when jest runs them on parallel workers.
msD('[integration][mssql] error mapping', () => {
  test('UNIQUE → UniqueConstraintError; FK → ForeignKeyConstraintError', async () => {
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
        "IF OBJECT_ID(N'dbo.child', N'U') IS NOT NULL DROP TABLE [dbo].[child]"
      );
      await p.executeNonQuery(
        "IF OBJECT_ID(N'dbo.parent', N'U') IS NOT NULL DROP TABLE [dbo].[parent]"
      );
      await p.executeNonQuery(
        'CREATE TABLE [dbo].[parent]([id] INT IDENTITY(1,1) PRIMARY KEY, [u] NVARCHAR(255) NOT NULL UNIQUE)'
      );
      await p.executeNonQuery(
        'CREATE TABLE [dbo].[child]([id] INT IDENTITY(1,1) PRIMARY KEY, [pid] INT NOT NULL, CONSTRAINT [fk_p] FOREIGN KEY ([pid]) REFERENCES [dbo].[parent]([id]))'
      );
      await p.executeNonQuery('INSERT INTO [dbo].[parent]([u]) VALUES(@p1)', ['x']);
      await expect(
        p.executeNonQuery('INSERT INTO [dbo].[parent]([u]) VALUES(@p1)', ['x'] as any)
      ).rejects.toBeInstanceOf(UniqueConstraintError);
      await expect(
        p.executeNonQuery('INSERT INTO [dbo].[child]([pid]) VALUES(@p1)', [9999] as any)
      ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    } finally {
      try {
        await p.executeNonQuery(
          "IF OBJECT_ID(N'dbo.child', N'U') IS NOT NULL DROP TABLE [dbo].[child]"
        );
      } catch {}
      try {
        await p.executeNonQuery(
          "IF OBJECT_ID(N'dbo.parent', N'U') IS NOT NULL DROP TABLE [dbo].[parent]"
        );
      } catch {}
    }
  });
});
