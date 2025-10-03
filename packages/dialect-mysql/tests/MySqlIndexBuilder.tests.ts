import { MySqlDdlStrategy } from '../src';

test('MySQL: expression-based index (functional)', () => {
  const sql = new MySqlDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_lower_email',
    columns: ['id'],
    unique: false,
    orders: undefined,
    expressions: ['LOWER(email)']
  });
  expect(sql).toContain('(id, (LOWER(email)))');
});

test('MySQL: index with column orders', () => {
  const sql = new MySqlDdlStrategy().generateCreateIndexSql('Users', {
    name: 'idx_users_email_created',
    columns: ['email', 'createdAt'],
    unique: true,
    orders: { email: 'ASC', createdAt: 'DESC' }
  });
  expect(sql).toContain('(email ASC, createdAt DESC)');
});

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

test('MySQL: FULLTEXT/SPATIAL index types', () => {
  const ddl = new MySqlDdlStrategy();
  const fulltext = ddl.generateCreateIndexSql('Articles', {
    name: 'idx_articles_ft_body',
    columns: ['body'],
    unique: false,
    mysqlType: 'FULLTEXT'
  });
  expect(fulltext).toContain(
    'CREATE FULLTEXT INDEX IF NOT EXISTS idx_articles_ft_body ON Articles (body)'
  );

  const spatial = ddl.generateCreateIndexSql('Places', {
    name: 'idx_places_geom',
    columns: ['geom'],
    unique: false,
    mysqlType: 'SPATIAL'
  });
  expect(spatial).toContain('CREATE SPATIAL INDEX IF NOT EXISTS idx_places_geom ON Places (geom)');
});
