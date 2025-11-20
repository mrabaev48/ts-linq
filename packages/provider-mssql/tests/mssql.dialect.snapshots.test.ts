import { MssqlDialect } from '@ts-linq/dialect-mssql';
import { QueryBuilder } from '@ts-linq/query';
import { MetadataStorage } from '@ts-linq/metadata';
import type { QueryOptions } from '@ts-linq/types';

class MsUser {
  id!: number;
  name!: string;
}

describe('MSSQL dialect snapshots', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(MsUser, 'Users');
    MetadataStorage.addColumn(MsUser, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true
    });
    MetadataStorage.addColumn(MsUser, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });
    MetadataStorage.addPrimaryKey(MsUser, 'id');
  });

  test('OFFSET/FETCH with ORDER fallback snapshot', () => {
    const qb = new QueryBuilder(new MssqlDialect());
    const opts: QueryOptions = {
      select: ['id', 'name'],
      offset: 10,
      limit: 5
    } as any;
    const built = qb.generateSql(MsUser as any, opts);
    expect(built).toMatchInlineSnapshot(`
      {
        "parameters": [],
        "query": "SELECT id, name FROM [Users] ORDER BY (SELECT NULL) OFFSET 10 ROWS FETCH NEXT 5 ROWS ONLY",
      }
    `);
  });
});
