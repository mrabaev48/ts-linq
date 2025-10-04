import { PostgresProvider } from '@ts-linq/provider-pg';
import { DatabaseError } from '@ts-linq/core';

const url = process.env.POSTGRES_URL || '';
const d = url ? describe : describe.skip;

d('[integration][postgres] statement timeout', () => {
  test('SET statement_timeout triggers DatabaseError on long query', async () => {
    const p = new PostgresProvider(url);
    await p.connect();
    try {
      await p.executeNonQuery('SET statement_timeout = 50');
      await expect(p.executeQuery('SELECT pg_sleep(0.2)')).rejects.toBeInstanceOf(DatabaseError);
    } finally {
      try {
        await p.executeNonQuery('RESET statement_timeout');
      } catch {}
    }
  });
});


