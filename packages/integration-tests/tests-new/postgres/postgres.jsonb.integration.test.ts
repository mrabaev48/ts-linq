import { PostgresProvider } from '@ts-linq/provider-postgres';

const url = process.env.POSTGRES_URL || '';
const pgDescribe = url ? describe : describe.skip;

pgDescribe('[integration][postgres] JSONB operations', () => {
  test('insert JSONB and query with @> and jsonb_path_query_first', async () => {
    const p = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "pg_jsonb"');
      await p.executeNonQuery(
        'CREATE TABLE IF NOT EXISTS "pg_jsonb"(id SERIAL PRIMARY KEY, data JSONB NOT NULL)'
      );
      await p.executeNonQuery(`INSERT INTO "pg_jsonb"(data) VALUES($1)`, [
        { a: { b: 1 }, tags: ['x', 'y'] } as unknown as never
      ]);
      const rows1 = await p.executeQuery<{ id: number }>(
        `SELECT id FROM "pg_jsonb" WHERE data @> $1`,
        [{ a: { b: 1 } } as unknown as never]
      );
      expect(rows1.length).toBe(1);
      const rows2 = await p.executeQuery<{ v: unknown }>(
        `SELECT jsonb_path_query_first(data, $1) AS v FROM "pg_jsonb"`,
        ['$.a.b']
      );
      // jsonb_path_query_first returns a JSONB scalar (number here)
      expect(rows2[0]?.v).toBe(1);
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS "pg_jsonb"');
      } catch {}
      await p.disconnect();
    }
  });
});
