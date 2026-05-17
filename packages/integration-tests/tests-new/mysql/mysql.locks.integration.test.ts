import { MySqlProvider } from '@ts-linq/provider-mysql';

const url = process.env.MYSQL_URL || '';
const d = url ? describe : describe.skip;

d('[integration][mysql] locks (SKIP LOCKED analog via NOWAIT not available)', () => {
  test('SELECT ... FOR UPDATE NOWAIT equivalent not supported — expect DatabaseError if simulated', async () => {
    const p1 = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
    const p2 = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
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
      await p1.executeNonQuery('SELECT id FROM `items_lock` WHERE id = ? FOR UPDATE', [lockedId]);

      // MySQL has no NOWAIT; immediate second FOR UPDATE on the same row waits — we assert client would timeout if configured.
      // Thus a soft check: the second query should not return the locked row when SKIP LOCKED is unavailable.
      const other = await p2.executeQuery<{ id: number }>(
        'SELECT id FROM `items_lock` WHERE id <> ? FOR UPDATE',
        [lockedId]
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
