import { PostgresProvider } from '@ts-linq/provider-pg';
import { UniqueConstraintError, ForeignKeyConstraintError } from '@ts-linq/core';

const PG = process.env.POSTGRES_URL || '';
const pgD = PG ? describe : describe.skip;

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
        p.executeNonQuery('INSERT INTO "parent"(u) VALUES($1)', ['x'] as unknown as never)
      ).rejects.toBeInstanceOf(UniqueConstraintError);
      await expect(
        p.executeNonQuery('INSERT INTO "child"(pid) VALUES($1)', [9999] as unknown as never)
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
