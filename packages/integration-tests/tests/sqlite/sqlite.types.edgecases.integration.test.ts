import { SQLiteProvider } from '@ts-linq/provider-sqlite';

describe('[integration][types][sqlite] NUMERIC/DATE', () => {
  test('NUMERIC precision-as-text and DATE', async () => {
    const p = new SQLiteProvider(':memory:');
    await p.connect?.();
    await p.executeNonQuery(
      'CREATE TABLE edge_types(id INTEGER PRIMARY KEY, amount NUMERIC NOT NULL, created_at TEXT NOT NULL)'
    );
    await p.executeNonQuery('INSERT INTO edge_types(id, amount, created_at) VALUES(1, ?, ?)', [
      '1234.56',
      '2020-01-02 03:04:05'
    ]);
    const rows = await p.executeQuery<{ amount: string; created_at: string }>(
      'SELECT amount, created_at FROM edge_types'
    );
    expect(String(rows[0].amount)).toBe('1234.56');
    expect(rows[0].created_at).toContain('2020-01-02');
  });
});
