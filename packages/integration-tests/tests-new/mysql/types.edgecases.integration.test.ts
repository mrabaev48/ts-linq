import { MySqlProvider } from '@ts-linq/provider-mysql';

const MY = process.env.MYSQL_URL || '';
const d = MY ? describe : describe.skip;

d('[integration][types][mysql] DECIMAL/date', () => {
  test('DECIMAL precision/scale and DATETIME', async () => {
    const p = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
    await p.connect();
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS `edge_types`');
      await p.executeNonQuery(
        'CREATE TABLE `edge_types`(id INT PRIMARY KEY, amount DECIMAL(10,2) NOT NULL, created_at DATETIME NOT NULL)'
      );
      await p.executeNonQuery('INSERT INTO `edge_types`(id, amount, created_at) VALUES(1, ?, ?)', [
        '1234.56' as unknown as never,
        '2020-01-02 03:04:05' as unknown as never
      ]);
      const rows = await p.executeQuery<{ amount: string; created_at: Date }>(
        'SELECT amount, created_at FROM `edge_types`'
      );
      expect(rows[0].amount).toBe('1234.56');
    } finally {
      try {
        await p.executeNonQuery('DROP TABLE IF EXISTS `edge_types`');
      } catch {}
    }
  });
});
