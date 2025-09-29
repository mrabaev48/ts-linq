import { MySqlDdlStrategy } from './MySqlDdlStrategy';

test('MySQL: index visibility (INVISIBLE)', () => {
  const sql = new MySqlDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_email_inv',
    columns: ['email'],
    unique: false,
    mysqlVisibility: 'INVISIBLE'
  });
  expect(sql).toContain(
    'CREATE INDEX IF NOT EXISTS idx_users_email_inv ON Users (email) INVISIBLE'
  );
});
