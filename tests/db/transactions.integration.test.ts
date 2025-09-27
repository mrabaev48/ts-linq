import { PostgresProvider } from '@ts-linq/postgres';
import { MySqlProvider } from '@ts-linq/mysql';
import { MssqlProvider } from '@ts-linq/mssql';
import { SQLiteProvider } from '@ts-linq/sqlite';

type ProviderLike = PostgresProvider | MySqlProvider | MssqlProvider | SQLiteProvider;

function suite(
  name: 'postgres' | 'mysql' | 'mssql' | 'sqlite',
  make: () => ProviderLike,
  tableSql: { create: string; drop: string }
) {
  const urlEnv = name === 'postgres' ? process.env.POSTGRES_URL
    : name === 'mysql' ? process.env.MYSQL_URL
    : name === 'mssql' ? process.env.MSSQL_URL
    : ':memory:';
  const d = urlEnv ? describe : describe.skip;
  d(`[integration][${name}] transactions`, () => {
    test('commit persists, rollback reverts', async () => {
      const p = make();
      try {
        await p.connect();
        await p.executeNonQuery(tableSql.create);
        await p.beginTransaction();
        await p.executeNonQuery(`INSERT INTO tx_items(name) VALUES('a')`);
        await p.commitTransaction();
        const afterCommit = await p.executeQuery<{ name: string }>(`SELECT name FROM tx_items`);
        expect(afterCommit.length).toBe(1);

        await p.beginTransaction();
        await p.executeNonQuery(`INSERT INTO tx_items(name) VALUES('b')`);
        await p.rollbackTransaction();
        const afterRollback = await p.executeQuery<{ name: string }>(`SELECT name FROM tx_items WHERE name='b'`);
        expect(afterRollback.length).toBe(0);
      } finally {
        try { await p.executeNonQuery(tableSql.drop); } catch {}
        try { await (p as ProviderLike & { dispose?: () => Promise<void> }).dispose?.(); } catch {}
      }
    });
  });
}

suite('postgres', () => new PostgresProvider(process.env.POSTGRES_URL || ''), {
  create: `CREATE TABLE IF NOT EXISTS "tx_items"(id SERIAL PRIMARY KEY, name TEXT NOT NULL)`,
  drop: `DROP TABLE IF EXISTS "tx_items"`
});

suite('mysql', () => new MySqlProvider(process.env.MYSQL_URL || ''), {
  create: 'CREATE TABLE IF NOT EXISTS `tx_items`(id INT AUTO_INCREMENT PRIMARY KEY, name TEXT NOT NULL)',
  drop: 'DROP TABLE IF EXISTS `tx_items`'
});

suite('mssql', () => new MssqlProvider(process.env.MSSQL_URL || ''), {
  create: 'IF OBJECT_ID(N"dbo.tx_items", N"U") IS NULL CREATE TABLE [dbo].[tx_items]([id] INT IDENTITY(1,1) PRIMARY KEY, [name] NVARCHAR(255) NOT NULL)',
  drop: 'IF OBJECT_ID(N"dbo.tx_items", N"U") IS NOT NULL DROP TABLE [dbo].[tx_items]'
});

suite('sqlite', () => new SQLiteProvider(':memory:'), {
  create: 'CREATE TABLE IF NOT EXISTS tx_items(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)',
  drop: 'DROP TABLE IF EXISTS tx_items'
});
