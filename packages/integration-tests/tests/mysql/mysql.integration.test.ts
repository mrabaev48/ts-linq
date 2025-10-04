import { MySqlProvider } from '@ts-linq/provider-mysql';

describe('MySqlProvider integration (smoke)', () => {
  const url = process.env.MYSQL_URL;
  it('connects and runs simple query', async () => {
    if (!url) return; // skip when container not running
    const provider = new MySqlProvider(url);
    await provider.connect();
    const rows = await provider.executeQuery<{ one: number }>('SELECT 1 as one');
    expect(rows[0]?.one).toBe(1);
    await provider.disconnect();
  });
});


