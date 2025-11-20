import { MySqlProvider } from '@ts-linq/provider-mysql';

describe('MySqlProvider integration (smoke)', () => {
  const url = process.env.MYSQL_URL;
  it('connects and runs simple query', async () => {
    if (!url) return; // skip when container not running
    const provider = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
    await provider.connect();
    const rows = await provider.executeQuery<{ one: number }>('SELECT 1 as one');
    expect(rows[0]?.one).toBe(1);
    await provider.disconnect();
  });
});
