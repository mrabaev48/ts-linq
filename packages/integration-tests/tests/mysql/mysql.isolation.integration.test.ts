import { MySqlProvider } from '@ts-linq/provider-mysql';

const url = process.env.MYSQL_URL || '';
const d = url ? describe : describe.skip;

d('[integration][mysql] isolation (REPEATABLE READ vs READ COMMITTED)', () => {
  test('REPEATABLE READ sees snapshot; READ COMMITTED sees updates', async () => {
    const p1 = new MySqlProvider(url);
    const p2 = new MySqlProvider(url);
    await p1.connect();
    await p2.connect();
    try {
      await p1.executeNonQuery('DROP TABLE IF EXISTS `iso_items`');
      await p1.executeNonQuery('CREATE TABLE `iso_items`(id INT PRIMARY KEY, v INT NOT NULL)');
      await p1.executeNonQuery('INSERT INTO `iso_items`(id, v) VALUES(1, 0)');

      await p1.executeNonQuery('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await p1.beginTransaction();
      const a1 = await p1.executeQuery<{ v: number }>('SELECT v FROM `iso_items` WHERE id=1');
      expect(a1[0].v).toBe(0);

      await p2.executeNonQuery('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await p2.beginTransaction();
      await p2.executeNonQuery('UPDATE `iso_items` SET v=1 WHERE id=1');
      await p2.commitTransaction();

      const a2 = await p1.executeQuery<{ v: number }>('SELECT v FROM `iso_items` WHERE id=1');
      expect(a2[0].v).toBe(0);
      await p1.commitTransaction();

      await p1.executeNonQuery('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await p1.beginTransaction();
      const a3 = await p1.executeQuery<{ v: number }>('SELECT v FROM `iso_items` WHERE id=1');
      expect(a3[0].v).toBe(1);
      await p1.commitTransaction();
    } finally {
      try {
        await p1.executeNonQuery('DROP TABLE IF EXISTS `iso_items`');
      } catch {}
    }
  });
});


