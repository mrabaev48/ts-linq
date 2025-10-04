import { MySqlProvider } from '@ts-linq/provider-mysql';

const url = process.env.MYSQL_URL || '';
const d = url ? describe : describe.skip;

d('[integration][mysql] upsert (ON DUPLICATE KEY UPDATE)', () => {
  test('insert then update same key', async () => {
    const p = new MySqlProvider(url);
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS `up_items`');
      await p.executeNonQuery('CREATE TABLE `up_items`(id INT PRIMARY KEY, name TEXT NOT NULL)');
      await p.executeNonQuery(
        'INSERT INTO `up_items`(id, name) VALUES(?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
        [1 as unknown as never, 'a']
      );
      await p.executeNonQuery(
        'INSERT INTO `up_items`(id, name) VALUES(?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
        [1 as unknown as never, 'b']
      );
      const rows = await p.executeQuery<{ name: string }>(
        'SELECT name FROM `up_items` WHERE id=?',
        [1 as unknown as never]
      );
      expect(rows[0].name).toBe('b');
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS `up_items`');
      } catch {}
    }
  });
});


