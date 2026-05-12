import { MySqlProvider } from '../src/MySqlProvider';

describe('MySqlProvider CRUD (smoke)', () => {
  const url = process.env.MYSQL_URL;
  it('create table, insert, select, update, delete', async () => {
    if (!url) return; // skip
    const p = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
    await p.connect();
    await p.executeNonQuery(
      'CREATE TABLE IF NOT EXISTS items(id INT AUTO_INCREMENT PRIMARY KEY, name TEXT NOT NULL)'
    );
    await p.executeNonQuery('INSERT INTO items(name) VALUES(?)', ['a']);
    let rows = await p.executeQuery<{ id: number; name: string }>('SELECT * FROM items');
    expect(rows.length).toBeGreaterThan(0);
    const id = rows[0].id;
    await p.executeNonQuery('UPDATE items SET name=? WHERE id=?', ['b', id]);
    rows = await p.executeQuery('SELECT name FROM items WHERE id=?', [id]);
    expect(rows[0]?.name).toBe('b');
    await p.executeNonQuery('DELETE FROM items WHERE id=?', [id]);
    rows = await p.executeQuery('SELECT * FROM items WHERE id=?', [id]);
    expect(rows.length).toBe(0);
    await p.disconnect();
  });
});
