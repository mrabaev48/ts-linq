import { PostgresDdlStrategy } from './PostgresDdlStrategy';

test('Postgres: index with COLLATE and NULLS', () => {
  const sql = new PostgresDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_email_created',
    columns: ['email', 'createdAt'],
    unique: false,
    where: undefined,
    orders: { createdAt: 'DESC' },
    collations: { email: '"en_US"' },
    nulls: { createdAt: 'LAST' }
  });
  expect(sql).toContain('("email" COLLATE "en_US", "createdAt" DESC NULLS LAST)');
});


