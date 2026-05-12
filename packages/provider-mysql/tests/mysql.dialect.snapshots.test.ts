import { MysqlDialect } from '@ts-linq/dialect-mysql';
import { MetadataStorage } from '@ts-linq/metadata';
import type { QueryOptions } from '@ts-linq/types';

class MUser {
  id!: number;
  title!: string;
  content!: string;
  payload!: string;
}

describe('MySQL dialect snapshots', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(MUser, 'm_users');
    MetadataStorage.addColumn(MUser, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(MUser, {
      propertyName: 'title',
      columnName: 'title',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addColumn(MUser, {
      propertyName: 'content',
      columnName: 'content',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addColumn(MUser, {
      propertyName: 'payload',
      columnName: 'payload',
      type: 'JSON',
      nullable: true
    });
    MetadataStorage.addPrimaryKey(MUser, 'id');
  });

  test('MATCH AGAINST and JSON_EXTRACT with parameters snapshot', () => {
    const dialect = new MysqlDialect();
    const opts: QueryOptions = {
      select: [
        'JSON_EXTRACT(payload, ?) AS val',
        'MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE) AS score'
      ],
      selectParams: ['$.a.b', 'mysql search']
    } as any;
    const built = dialect.buildSelect(MUser as any, opts);
    expect(built).toMatchInlineSnapshot(`
      {
        "parameters": [
          "$.a.b",
          "mysql search",
        ],
        "query": "SELECT JSON_EXTRACT(payload, ?) AS val, MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE) AS score FROM \`m_users\`",
      }
    `);
  });
});
