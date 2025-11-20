import { MssqlProvider } from '@ts-linq/provider-mssql';

describe('MssqlProvider integration (smoke)', () => {
  const url = process.env.MSSQL_URL;
  it('connects and runs simple query', async () => {
    if (!url) return; // skip
    const provider = new MssqlProvider({
      server: process.env.MSSQL_SERVER || 'localhost',
      port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT) : 1433,
      database: process.env.MSSQL_DB || 'test',
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD
    });
    await provider.connect();
    const rows = await provider.executeQuery<{ one: number }>('SELECT 1 as one');
    expect(rows[0]?.one).toBe(1);
    await provider.disconnect();
  });
});
