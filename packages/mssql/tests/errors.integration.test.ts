import { PostgresProvider } from '@ts-linq/postgres';
import { MySqlProvider } from '@ts-linq/mysql';
import { MssqlProvider } from '@ts-linq/mssql';
import { UniqueConstraintError, ForeignKeyConstraintError } from '@ts-linq/core';

const PG = process.env.POSTGRES_URL || '';
const MY = process.env.MYSQL_URL || '';
const MS = process.env.MSSQL_URL || '';

const pgD = PG ? describe : describe.skip;
const myD = MY ? describe : describe.skip;
const msD = MS ? describe : describe.skip;

pgD('[integration][postgres] error mapping', () => {
  test('UNIQUE → UniqueConstraintError; FK → ForeignKeyConstraintError', async () => {
    const p = new PostgresProvider(PG);
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
    const p = new MySqlProvider(MY);
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
    const p = new MssqlProvider(MS);
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
