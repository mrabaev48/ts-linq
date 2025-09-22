import { PostgresDdlStrategy } from './PostgresDdlStrategy';

test('Postgres: partial unique index with WHERE', () => {
  const ddl = new PostgresDdlStrategy().generateCreateIndexSql(
    'Users',
    { name: 'idx_users_active_unique', columns: ['email'], unique: true, where: 'active = true' }
  );
  expect(ddl).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_active_unique" ON "Users" ("email") WHERE active = true');
});


