import { SQLiteDialect } from './SQLiteDialect';
import { MetadataStorage } from '@ts-linq/core';

class TestUser {
  id!: number;
  title!: string;
  body!: string;
  payload!: string;
}

describe('SQLiteDialect buildSelect parameterization', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(TestUser, 'test_users');
    MetadataStorage.addColumn(TestUser, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(TestUser, {
      propertyName: 'title',
      columnName: 'title',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addColumn(TestUser, {
      propertyName: 'body',
      columnName: 'body',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addColumn(TestUser, {
      propertyName: 'payload',
      columnName: 'payload',
      type: 'JSON',
      nullable: true
    });
    MetadataStorage.addPrimaryKey(TestUser, 'id');
  });

  test('renders JSON_EXTRACT and MATCH-like helpers with parameters', () => {
    const dialect = new SQLiteDialect();
    const res = dialect.buildSelect(
      TestUser as any,
      {
        select: ['json_extract(payload, ?) AS val', "bm25(matchinfo('fts')) AS score"],
        selectParams: ['$.a.b'],
        where: []
      } as any
    );
    expect(res.query).toContain('SELECT json_extract(payload, ?) AS val');
    expect(res.parameters).toEqual(['$.a.b']);
  });
});
