import { MysqlDialect, MySqlDdlStrategy } from '../src';
import { MetadataStorage } from '@ts-linq/core';

class TestUser {
  id!: number;
  title!: string;
  body!: string;
  payload!: string;
}

describe('MysqlDialect buildSelect parameterization', () => {
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

  test('renders JSON_EXTRACT and MATCH with parameters', () => {
    const dialect = new MysqlDialect();
    const res = dialect.buildSelect(
      TestUser as any,
      {
        select: [
          'JSON_EXTRACT(payload, ?) AS val',
          'MATCH(title, body) AGAINST (? IN BOOLEAN MODE) AS score'
        ],
        selectParams: ['$.a.b', 'golang'],
        where: []
      } as any
    );
    expect(res.query).toContain(
      'SELECT JSON_EXTRACT(payload, ?) AS val, MATCH(title, body) AGAINST (? IN BOOLEAN MODE) AS score FROM `test_users`'
    );
    expect(res.parameters).toEqual(['$.a.b', 'golang']);
  });

  test('DDL: computed column rendered', () => {
    MetadataStorage.addColumn(TestUser, {
      propertyName: 'nameLength',
      columnName: 'name_len',
      type: 'INTEGER',
      nullable: true,
      isComputed: true,
      computedExpression: 'length(title)'
    } as any);
    const meta = MetadataStorage.getEntity(TestUser) as any;
    const ddl = new MySqlDdlStrategy().generateCreateTableSql(meta);
    expect(ddl).toContain('name_len INT GENERATED ALWAYS AS (length(title)) VIRTUAL');
  });
});
