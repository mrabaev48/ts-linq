import { PostgresProvider } from '@ts-linq/postgres';

describe('PostgresProvider CRUD (smoke)', () => {
  const url = process.env.POSTGRES_URL;
  it('create table, insert, select, update, delete', async () => {
    if (!url) return; // skip
    const p = new PostgresProvider(url);
    await p.connect();
    await p.executeNonQuery(
      'CREATE TABLE IF NOT EXISTS items(id SERIAL PRIMARY KEY, name TEXT NOT NULL)'
    );
    await p.executeNonQuery('INSERT INTO items(name) VALUES($1)', ['a']);
    let rows = await p.executeQuery<{ id: number; name: string }>('SELECT * FROM items');
    expect(rows.length).toBeGreaterThan(0);
    const id = rows[0].id;
    await p.executeNonQuery('UPDATE items SET name=$1 WHERE id=$2', ['b', id]);
    rows = await p.executeQuery('SELECT name FROM items WHERE id=$1', [id]);
    expect(rows[0]?.name).toBe('b');
    await p.executeNonQuery('DELETE FROM items WHERE id=$1', [id]);
    rows = await p.executeQuery('SELECT * FROM items WHERE id=$1', [id]);
    expect(rows.length).toBe(0);
    await p.disconnect();
  });
});
