import { MySqlProvider } from '@ts-linq/provider-mysql';

const url = process.env.MYSQL_URL || '';
const d = url ? describe : describe.skip;

d('[integration][mysql] upsert (ON DUPLICATE KEY UPDATE)', () => {
  test('insert then update same key', async () => {
    const p = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS `up_items`');
      await p.executeNonQuery('CREATE TABLE `up_items`(id INT PRIMARY KEY, name TEXT NOT NULL)');
      await p.executeNonQuery(
        'INSERT INTO `up_items`(id, name) VALUES(?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
        [1, 'a']
      );
      await p.executeNonQuery(
        'INSERT INTO `up_items`(id, name) VALUES(?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
        [1, 'b']
      );
      const rows = await p.executeQuery<{ name: string }>(
        'SELECT name FROM `up_items` WHERE id=?',
        [1]
      );
      expect(rows[0].name).toBe('b');
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS `up_items`');
      } catch {}
    }
  });
});
