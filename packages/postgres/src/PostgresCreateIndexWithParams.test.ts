import { PostgresDdlStrategy } from './PostgresDdlStrategy';

test('Postgres: index WITH (...) params', () => {
  const sql = new PostgresDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_email_btree',
    columns: ['email'],
    unique: false,
    using: 'btree',
    withParams: { fillfactor: 90 }
  });
  expect(sql).toContain('WITH (fillfactor=90)');
});


