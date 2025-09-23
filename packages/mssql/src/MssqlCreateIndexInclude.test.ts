import { MssqlDdlStrategy } from './MssqlDdlStrategy';

test('MSSQL: index with INCLUDE(...)', () => {
  const sql = new MssqlDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_active_inc',
    columns: ['active'],
    unique: false,
    include: ['email', 'createdAt']
  });
  expect(sql).toContain('INCLUDE (email, createdAt)');
});


