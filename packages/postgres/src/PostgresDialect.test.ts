import { PostgresDialect } from './PostgresDialect';
import { MetadataStorage } from '@ts-linq/core';

class TestUser { id!: number; title!: string; content!: string; data!: string; }

describe('PostgresDialect buildSelect parameterization', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(TestUser, 'test_users');
    MetadataStorage.addColumn(TestUser, { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true });
    MetadataStorage.addColumn(TestUser, { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: false });
    MetadataStorage.addColumn(TestUser, { propertyName: 'content', columnName: 'content', type: 'TEXT', nullable: false });
    MetadataStorage.addColumn(TestUser, { propertyName: 'data', columnName: 'data', type: 'JSONB', nullable: true });
    MetadataStorage.addPrimaryKey(TestUser, 'id');
  });

  test('renders JSON and FTS with parameters', () => {
    const dialect = new PostgresDialect();
    const select = [
      "jsonb_path_query_first(data, $1) AS val",
      "ts_rank(to_tsvector($2, COALESCE(title, '') || ' ' || COALESCE(content, '')), websearch_to_tsquery($3, $4)) AS score"
    ];
    const res = dialect.buildSelect(TestUser as any, {
      select,
      selectParams: ['$.a.b', 'simple', 'simple', 'node js'],
      where: []
    } as any);
    expect(res.query).toContain('SELECT');
    expect(res.parameters).toEqual(['$.a.b', 'simple', 'simple', 'node js']);
  });
});


