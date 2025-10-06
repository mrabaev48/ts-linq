import { MssqlProvider } from '../src';

describe('Mssql errors mapping (integration)', () => {
  const url = process.env.MSSQL_URL;
  it('unique constraint', async () => {
    if (!url) return; // skip
    const p = new MssqlProvider(url);
    await p.connect();
    await p.executeNonQuery(
      "IF OBJECT_ID('uniq','U') IS NULL CREATE TABLE uniq(id INT PRIMARY KEY, name NVARCHAR(50) NOT NULL)"
    );
    await p.executeNonQuery('INSERT INTO uniq(id, name) VALUES(@p1, @p2)', [1, 'a']);
    await expect(
      p.executeNonQuery('INSERT INTO uniq(id, name) VALUES(@p1, @p2)', [1, 'b'])
    ).rejects.toBeInstanceOf(Error);
    await p.disconnect();
  });
});
