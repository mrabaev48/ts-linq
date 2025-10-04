import { MssqlProvider } from '@ts-linq/provider-mssql';

describe('MssqlProvider CRUD (smoke)', () => {
  const url = process.env.MSSQL_URL;
  it('create table, insert, select, update, delete', async () => {
    if (!url) return; // skip
    const p = new MssqlProvider(url);
    await p.connect();
    await p.executeNonQuery(
      "IF OBJECT_ID('items','U') IS NULL CREATE TABLE items(id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(50) NOT NULL)"
    );
    await p.executeNonQuery('INSERT INTO items(name) VALUES(@p1)', ['a']);
    let rows = await p.executeQuery<{ id: number; name: string }>('SELECT * FROM items');
    expect(rows.length).toBeGreaterThan(0);
    const id = rows[0].id;
    await p.executeNonQuery('UPDATE items SET name=@p1 WHERE id=@p2', ['b', id]);
    rows = await p.executeQuery('SELECT name FROM items WHERE id=@p1', [id]);
    expect(rows[0]?.name).toBe('b');
    await p.executeNonQuery('DELETE FROM items WHERE id=@p1', [id]);
    rows = await p.executeQuery('SELECT * FROM items WHERE id=@p1', [id]);
    expect(rows.length).toBe(0);
    await p.disconnect();
  });
});


