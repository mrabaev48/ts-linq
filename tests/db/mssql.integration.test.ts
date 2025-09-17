import { MssqlProvider } from '@ts-linq/mssql';

describe('MssqlProvider integration (smoke)', () => {
  const url = process.env.MSSQL_URL;
  it('connects and runs simple query', async () => {
    if (!url) return; // skip
    const provider = new MssqlProvider(url);
    await provider.connect();
    const rows = await provider.executeQuery<{ one: number }>('SELECT 1 as one');
    expect(rows[0]?.one).toBe(1);
    await provider.disconnect();
  });
});
