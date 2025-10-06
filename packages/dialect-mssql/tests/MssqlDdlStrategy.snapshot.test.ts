import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/core';
import { MssqlDdlStrategy } from '../src';

class User {
  id!: number;
  title!: string;
  nameLength!: number;
}

beforeEach(() => {
  MetadataStorage.getInstance().clear();
});

test('MSSQL DDL snapshot: computed + PK', () => {
  MetadataStorage.addEntity(User, 'Users');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
    { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: false },
    {
      propertyName: 'nameLength',
      columnName: 'name_len',
      type: 'INTEGER',
      nullable: true,
      isComputed: true,
      computedExpression: 'len(title)'
    }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(User, c));
  MetadataStorage.addPrimaryKey(User, 'id');
  const meta = MetadataStorage.getEntity(User) as EntityMetadata;
  const ddl = new MssqlDdlStrategy().generateCreateTableSql(meta);
  expect(ddl).toMatchInlineSnapshot(
    `"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users') BEGIN CREATE TABLE Users (id INT NOT NULL, title NVARCHAR(MAX) NOT NULL, name_len AS (len(title)), PRIMARY KEY (id)) END"`
  );
});
