import { MySqlProvider } from '@ts-linq/provider-mysql';

const url = process.env.MYSQL_URL || '';
const d = url ? describe : describe.skip;

d('[integration][mysql] locks (no NOWAIT)', () => {
  test('SELECT ... FOR UPDATE on other rows excludes locked row', async () => {
    const p1 = new MySqlProvider(url);
    const p2 = new MySqlProvider(url);
    await p1.connect();
    await p2.connect();
    try {
      await p1.executeNonQuery('DROP TABLE IF EXISTS `items_lock`');
      await p1.executeNonQuery(
        'CREATE TABLE `items_lock`(id INT AUTO_INCREMENT PRIMARY KEY, name TEXT NOT NULL)'
      );
      await p1.executeNonQuery("INSERT INTO `items_lock`(name) VALUES('a'),('b')");

      await p1.beginTransaction();
      const rows = await p1.executeQuery<{ id: number }>(
        'SELECT id FROM `items_lock` ORDER BY id LIMIT 1'
      );
      const lockedId = rows[0].id;
      await p1.executeNonQuery('SELECT id FROM `items_lock` WHERE id = ? FOR UPDATE', [
        lockedId as unknown as never
      ]);

      const other = await p2.executeQuery<{ id: number }>(
        'SELECT id FROM `items_lock` WHERE id <> ? FOR UPDATE',
        [lockedId as unknown as never]
      );
      expect(other.some((r) => r.id === lockedId)).toBe(false);

      await p1.commitTransaction();
    } finally {
      try {
        await p1.executeNonQuery('DROP TABLE IF EXISTS `items_lock`');
      } catch {}
    }
  });
});
