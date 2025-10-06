import { SQLiteProvider } from '@ts-linq/provider-sqlite';

describe('[integration][sqlite] upsert (INSERT OR REPLACE)', () => {
  test('insert then replace same key', async () => {
    const p = new SQLiteProvider(':memory:');
    await p.connect?.();
    await p.executeNonQuery('CREATE TABLE up_items(id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    await p.executeNonQuery('INSERT OR REPLACE INTO up_items(id, name) VALUES(?, ?)', [1, 'a']);
    await p.executeNonQuery('INSERT OR REPLACE INTO up_items(id, name) VALUES(?, ?)', [1, 'b']);
    const rows = await p.executeQuery<{ name: string }>('SELECT name FROM up_items WHERE id = ?', [
      1
    ]);
    expect(rows[0].name).toBe('b');
  });
});
