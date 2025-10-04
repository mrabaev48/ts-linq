import { MySqlProvider } from '@ts-linq/provider-mysql';
import { UniqueConstraintError, ForeignKeyConstraintError } from '@ts-linq/core';

const MY = process.env.MYSQL_URL || '';

const myD = MY ? describe : describe.skip;

myD('[integration][mysql] error mapping', () => {
  test('UNIQUE → UniqueConstraintError; FK → ForeignKeyConstraintError', async () => {
    const p = new MySqlProvider(MY);
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS `child`');
      await p.executeNonQuery('DROP TABLE IF EXISTS `parent`');
      await p.executeNonQuery(
        'CREATE TABLE `parent`(id INT AUTO_INCREMENT PRIMARY KEY, u TEXT NOT NULL, UNIQUE KEY uq_u (u(255)))'
      );
      await p.executeNonQuery(
        'CREATE TABLE `child`(id INT AUTO_INCREMENT PRIMARY KEY, pid INT NOT NULL, CONSTRAINT fk_p FOREIGN KEY (pid) REFERENCES `parent`(id))'
      );
      await p.executeNonQuery('INSERT INTO `parent`(u) VALUES(?)', ['x']);
      await expect(
        p.executeNonQuery('INSERT INTO `parent`(u) VALUES(?)', ['x'] as any)
      ).rejects.toBeInstanceOf(UniqueConstraintError);
      await expect(
        p.executeNonQuery('INSERT INTO `child`(pid) VALUES(?)', [9999] as any)
      ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS `child`');
      } catch {}
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS `parent`');
      } catch {}
    }
  });
});
