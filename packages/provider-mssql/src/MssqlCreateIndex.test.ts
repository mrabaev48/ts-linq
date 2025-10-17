import { MssqlDdlStrategy } from './MssqlDdlStrategy';

test('MSSQL: filtered index with WHERE', () => {
  const ddl = new MssqlDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_active',
    columns: ['active'],
    unique: false,
    where: 'active = 1'
  });
  expect(ddl).toContain('CREATE INDEX idx_users_active ON Users (active) WHERE active = 1');
});
