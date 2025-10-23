import { SQLiteProvider } from '@ts-linq/provider-sqlite';

const d = describe; // sqlite in-memory is always available

d('[integration][sqlite] transactions', () => {
  test('commit persists, rollback reverts', async () => {
    const p = new SQLiteProvider(':memory:');
    await p.connect?.();
    try {
      await p.executeNonQuery(
        'CREATE TABLE IF NOT EXISTS tx_items(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)'
      );

      await p.beginTransaction();
      await p.executeNonQuery("INSERT INTO tx_items(name) VALUES('a')");
      await p.commitTransaction();
      const afterCommit = await p.executeQuery<{ name: string }>('SELECT name FROM tx_items');
      expect(afterCommit.length).toBe(1);

      await p.beginTransaction();
      await p.executeNonQuery("INSERT INTO tx_items(name) VALUES('b')");
      await p.rollbackTransaction();
      const afterRollback = await p.executeQuery<{ name: string }>(
        "SELECT name FROM tx_items WHERE name='b'"
      );
      expect(afterRollback.length).toBe(0);
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS tx_items');
      } catch {}
    }
  });
});
