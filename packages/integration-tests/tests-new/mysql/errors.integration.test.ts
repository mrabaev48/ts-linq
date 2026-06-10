import { MySqlProvider } from '@ts-linq/provider-mysql';
import { ForeignKeyConstraintError, UniqueConstraintError } from '@ts-linq/types';

const MY = process.env.MYSQL_URL || '';
const myD = MY ? describe : describe.skip;

// Provider-scoped on purpose: this file exercises ONLY MySQL so its `parent`/`child`
// DDL never races the identically-named tables driven by the postgres/mssql error suites
// when jest runs them on parallel workers.
myD('[integration][mysql] error mapping', () => {
  test('UNIQUE → UniqueConstraintError; FK → ForeignKeyConstraintError', async () => {
    const p = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
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
