import { PostgresDdlStrategy } from './PostgresDdlStrategy';

test('Postgres: index USING GIN and CONCURRENTLY', () => {
  const sql = new PostgresDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_tags_gin',
    columns: [],
    unique: false,
    where: undefined,
    orders: undefined,
    expressions: ['to_tsvector(\'english\', coalesce(tags, \"\"))'],
    using: 'gin',
    concurrently: true
  });
  expect(sql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS');
  expect(sql).toContain('USING GIN');
});


