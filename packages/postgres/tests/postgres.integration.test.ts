import { PostgresProvider } from '@ts-linq/postgres';

class Ping {
  id!: number;
}

describe('PostgresProvider integration (smoke)', () => {
  const url = process.env.POSTGRES_URL;
  it('connects and runs simple query', async () => {
    if (!url) return; // skip when container not running
    const provider = new PostgresProvider(url);
    await provider.connect();
    const rows = await provider.executeQuery<{ one: number }>('SELECT 1 as one');
    expect(rows[0]?.one).toBe(1);
    await provider.disconnect();
  });
});
