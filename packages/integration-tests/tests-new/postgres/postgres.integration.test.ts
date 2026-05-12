import { PostgresProvider } from '@ts-linq/provider-postgres';

describe('PostgresProvider integration (smoke)', () => {
  const url = process.env.POSTGRES_URL;
  it('connects and runs simple query', async () => {
    if (!url) return; // skip when container not running
    const provider = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    await provider.connect();
    const rows = await provider.executeQuery<{ one: number }>('SELECT 1 as one');
    expect(rows[0]?.one).toBe(1);
    await provider.disconnect();
  });
});
