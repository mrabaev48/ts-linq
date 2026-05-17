import { MssqlProvider } from '@ts-linq/provider-mssql';
import { MySqlProvider } from '@ts-linq/provider-mysql';
import { PostgresProvider } from '@ts-linq/provider-postgres';
import { ForeignKeyConstraintError, UniqueConstraintError } from '@ts-linq/types';

const PG = process.env.POSTGRES_URL || '';
const MY = process.env.MYSQL_URL || '';
const MS = process.env.MSSQL_URL || '';

const pgD = PG ? describe : describe.skip;
const myD = MY ? describe : describe.skip;
const msD = MS ? describe : describe.skip;

pgD('[integration][postgres] error mapping', () => {
  test('UNIQUE → UniqueConstraintError; FK → ForeignKeyConstraintError', async () => {
    const p = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "child"');
      await p.executeNonQuery('DROP TABLE IF EXISTS "parent"');
      await p.executeNonQuery(
        'CREATE TABLE "parent"(id SERIAL PRIMARY KEY, u TEXT UNIQUE NOT NULL)'
      );
      await p.executeNonQuery(
        'CREATE TABLE "child"(id SERIAL PRIMARY KEY, pid INTEGER NOT NULL REFERENCES "parent"(id))'
      );
      await p.executeNonQuery('INSERT INTO "parent"(u) VALUES($1)', ['x']);
      await expect(
        p.executeNonQuery('INSERT INTO "parent"(u) VALUES($1)', ['x'] as any)
      ).rejects.toBeInstanceOf(UniqueConstraintError);
      await expect(
        p.executeNonQuery('INSERT INTO "child"(pid) VALUES($1)', [9999] as any)
      ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS "child"');
      } catch {}
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS "parent"');
      } catch {}
    }
  });
});

myD('[integration][mysql] error mapping', () => {
  test('UNIQUE → UniqueConstraintError; FK → ForeignKeyConstraintError', async () => {
    const p = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS `child`');
      await p.executeNonQuery('DROP TABLE IF EXISTS `parent`');
      await p.executeNonQuery(
        'CREATE TABLE `parent`(id INT AUTO_INCREMENT PRIMARY KEY, u TEXT NOT NULL, UNIQUE KEY uq_u (u(255)))'
      );
      await p.executeNonQuery(
        'CREATE TABLE `child`(id INT AUTO_INCREMENT PRIMARY KEY, pid INT NOT NULL, CONSTRAINT fk_p FOREIGN KEY (pid) REFERENCES `parent`(id))'
      );
      await p.executeNonQuery('INSERT INTO `parent`(u) VALUES(?)', ['x']);
      await expect(
        p.executeNonQuery('INSERT INTO `parent`(u) VALUES(?)', ['x'] as any)
      ).rejects.toBeInstanceOf(UniqueConstraintError);
      await expect(
        p.executeNonQuery('INSERT INTO `child`(pid) VALUES(?)', [9999] as any)
      ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS `child`');
      } catch {}
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS `parent`');
      } catch {}
    }
  });
});

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
        'IF OBJECT_ID(N"dbo.child", N"U") IS NOT NULL DROP TABLE [dbo].[child]'
      );
      await p.executeNonQuery(
        'IF OBJECT_ID(N"dbo.parent", N"U") IS NOT NULL DROP TABLE [dbo].[parent]'
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
          'IF OBJECT_ID(N"dbo.child", N"U") IS NOT NULL DROP TABLE [dbo].[child]'
        );
      } catch {}
      try {
        await p.executeNonQuery(
          'IF OBJECT_ID(N"dbo.parent", N"U") IS NOT NULL DROP TABLE [dbo].[parent]'
        );
      } catch {}
    }
  });
});
