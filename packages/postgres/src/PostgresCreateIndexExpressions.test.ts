import { PostgresDdlStrategy } from './PostgresDdlStrategy';

test('Postgres: expression-based index', () => {
  const sql = new PostgresDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_lower_email',
    columns: ['id'],
    unique: false,
    where: undefined,
    orders: undefined,
    expressions: ['LOWER(email)']
  });
  expect(sql).toContain('("id", (LOWER(email)))');
});


