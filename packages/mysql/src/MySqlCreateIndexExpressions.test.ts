import { MySqlDdlStrategy } from './MySqlDdlStrategy';

test('MySQL: expression-based index (functional)', () => {
  const sql = new MySqlDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_lower_email',
    columns: ['id'],
    unique: false,
    orders: undefined,
    expressions: ['LOWER(email)']
  });
  expect(sql).toContain('(id, (LOWER(email)))');
});
