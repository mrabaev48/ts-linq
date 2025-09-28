import { PostgresDdlStrategy } from './PostgresDdlStrategy';

test('Postgres: index with column orders', () => {
  const sql = new PostgresDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_email_created',
    columns: ['email', 'createdAt'],
    unique: false,
    where: undefined,
    orders: { email: 'ASC', createdAt: 'DESC' }
  });
  expect(sql).toContain('("email" ASC, "createdAt" DESC)');
});
