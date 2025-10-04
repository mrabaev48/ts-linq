import { SQLiteProvider } from '@ts-linq/provider-sqlite';

describe('SQLite M2M basics (integration)', () => {
  test('create tables and insert junction rows', async () => {
    const p = new SQLiteProvider(':memory:');
    await p.connect();
    await p.executeNonQuery('CREATE TABLE IF NOT EXISTS A(id INTEGER PRIMARY KEY)');
    await p.executeNonQuery('CREATE TABLE IF NOT EXISTS B(id INTEGER PRIMARY KEY)');
    await p.executeNonQuery('CREATE TABLE IF NOT EXISTS A_B(aId INTEGER, bId INTEGER)');
    await p.executeNonQuery('INSERT INTO A(id) VALUES (1)');
    await p.executeNonQuery('INSERT INTO B(id) VALUES (1)');
    await p.executeNonQuery('INSERT INTO A_B(aId, bId) VALUES (?, ?)', [1, 1]);
    const rows = await p.executeQuery<{ aId: number; bId: number }>('SELECT * FROM A_B');
    expect(rows[0]).toEqual({ aId: 1, bId: 1 });
    await p.disconnect();
  });
});


