import { PostgresProvider } from '@ts-linq/provider-postgres';
import { ForeignKeyConstraintError, UniqueConstraintError } from '@ts-linq/types';

const PG = process.env.POSTGRES_URL || '';
const pgD = PG ? describe : describe.skip;

// Provider-scoped on purpose: this file exercises ONLY Postgres so its `parent`/`child`
// DDL never races the identically-named tables driven by the mysql/mssql error suites
// when jest runs them on parallel workers.
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
