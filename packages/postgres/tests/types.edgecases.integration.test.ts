import { PostgresProvider } from '@ts-linq/postgres';

const PG = process.env.POSTGRES_URL || '';
const d = PG ? describe : describe.skip;

d('[integration][types][pg] DECIMAL/UUID/date', () => {
  test('DECIMAL precision/scale, UUID, TIMESTAMP', async () => {
    const p = new PostgresProvider(PG);
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "edge_types"');
      await p.executeNonQuery('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await p.executeNonQuery(
        'CREATE TABLE "edge_types"(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), amount DECIMAL(10,2) NOT NULL, created_at TIMESTAMP NOT NULL)'
      );
      await p.executeNonQuery('INSERT INTO "edge_types"(amount, created_at) VALUES($1, $2)', [
        '1234.56' as unknown as never,
        new Date('2020-01-02T03:04:05Z') as unknown as never
      ]);
      const rows = await p.executeQuery<{ amount: string; created_at: Date }>(
        'SELECT amount::text AS amount, created_at FROM "edge_types"'
      );
      expect(rows[0].amount).toBe('1234.56');
      expect(new Date(rows[0].created_at).toISOString()).toBe('2020-01-02T03:04:05.000Z');
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS "edge_types"');
      } catch {}
    }
  });
});
