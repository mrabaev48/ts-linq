import { SQLiteDialect } from '@ts-linq/sqlite';
import { MetadataStorage, QueryBuilder, type QueryOptions } from '@ts-linq/core';

class SqUser {
  id!: number;
  name!: string;
}

describe('SQLite dialect snapshots', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(SqUser, 'users');
    MetadataStorage.addColumn(SqUser, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(SqUser, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(SqUser, 'id');
  });

  test('OFFSET without LIMIT inserts LIMIT -1 snapshot', () => {
    const qb = new QueryBuilder(new SQLiteDialect());
    const opts: QueryOptions = {
      select: ['id', 'name'],
      offset: 3
    } as any;
    const built = qb.generateSql(SqUser as any, opts);
    expect(built).toMatchInlineSnapshot(`
      {
        "parameters": [],
        "query": "SELECT id, name FROM users LIMIT -1 OFFSET 3",
      }
    `);
  });
});
