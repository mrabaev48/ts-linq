import { PostgresProvider } from '@ts-linq/provider-postgres';
import { DatabaseError } from '@ts-linq/types';

const url = process.env.POSTGRES_URL || '';
const d = url ? describe : describe.skip;

d('[integration][postgres] statement timeout', () => {
  test('SET statement_timeout triggers DatabaseError on long query', async () => {
    const p = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
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
