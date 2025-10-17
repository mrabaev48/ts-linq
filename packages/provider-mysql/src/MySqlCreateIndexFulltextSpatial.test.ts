import { MySqlDdlStrategy } from './MySqlDdlStrategy';

test('MySQL: FULLTEXT index', () => {
  const sql = new MySqlDdlStrategy().generateCreateIndexSql('Articles', {
    name: 'idx_articles_ft_body',
    columns: ['body'],
    unique: false,
    mysqlType: 'FULLTEXT'
  });
  expect(sql).toContain(
    'CREATE FULLTEXT INDEX IF NOT EXISTS idx_articles_ft_body ON Articles (body)'
  );
});

test('MySQL: SPATIAL index', () => {
  const sql = new MySqlDdlStrategy().generateCreateIndexSql('Places', {
    name: 'idx_places_geom',
    columns: ['geom'],
    unique: false,
    mysqlType: 'SPATIAL'
  });
  expect(sql).toContain('CREATE SPATIAL INDEX IF NOT EXISTS idx_places_geom ON Places (geom)');
});
