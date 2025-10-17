import { MySqlDdlStrategy } from './MySqlDdlStrategy';

test('MySQL: index with column orders', () => {
  const sql = new MySqlDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_email_created',
    columns: ['email', 'createdAt'],
    unique: true,
    orders: { email: 'ASC', createdAt: 'DESC' }
  });
  expect(sql).toContain('(email ASC, createdAt DESC)');
});
