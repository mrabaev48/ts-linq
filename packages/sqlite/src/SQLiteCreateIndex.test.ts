import { SQLiteDdlStrategy } from './SQLiteDdlStrategy';

test('SQLite: partial index with WHERE', () => {
  const ddl = new SQLiteDdlStrategy().generateCreateIndexSql(
    'Users',
    { name: 'idx_users_active', columns: ['active'], unique: false, where: 'active = 1' }
  );
  expect(ddl).toBe('CREATE INDEX IF NOT EXISTS idx_users_active ON Users (active) WHERE active = 1');
});


