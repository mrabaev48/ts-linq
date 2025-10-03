import { PostgresProvider } from '@ts-linq/provider-pg';

const url = process.env.POSTGRES_URL || '';
const d = url ? describe : describe.skip;

d('[integration][postgres] INSERT/UPDATE RETURNING', () => {
  test('INSERT ... RETURNING and UPDATE ... RETURNING return rows', async () => {
    const p = new PostgresProvider(url);
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "ret_items"');
      await p.executeNonQuery(
        'CREATE TABLE "ret_items"(id SERIAL PRIMARY KEY, name TEXT NOT NULL)'
      );
      const ins = await p.executeQuery<{ id: number; name: string }>(
        'INSERT INTO "ret_items"(name) VALUES($1) RETURNING id, name',
        ['x']
      );
      expect(ins[0].name).toBe('x');
      const up = await p.executeQuery<{ id: number; name: string }>(
        'UPDATE "ret_items" SET name=$1 WHERE id=$2 RETURNING id, name',
        ['y', ins[0].id as unknown as never]
      );
      expect(up[0].name).toBe('y');
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS "ret_items"');
      } catch {}
    }
  });
});
