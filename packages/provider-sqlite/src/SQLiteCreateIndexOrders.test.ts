import { SQLiteDdlStrategy } from './SQLiteDdlStrategy';

test('SQLite: index with column orders', () => {
  const sql = new SQLiteDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_email_created',
    columns: ['email', 'createdAt'],
    unique: false,
    orders: { email: 'ASC', createdAt: 'DESC' }
  });
  expect(sql).toContain('(email ASC, createdAt DESC)');
});
