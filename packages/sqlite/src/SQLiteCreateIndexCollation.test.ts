import { SQLiteDdlStrategy } from './SQLiteDdlStrategy';

test('SQLite: index with COLLATE', () => {
  const sql = new SQLiteDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_email',
    columns: ['email'],
    unique: false,
    where: undefined,
    orders: undefined,
    expressions: [],
    collations: { email: 'NOCASE' }
  });
  expect(sql).toContain('(email COLLATE NOCASE)');
});
