import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/core';
import { SQLiteDdlStrategy } from './SQLiteDdlStrategy';

class User {
  id!: number;
  name!: string;
  nameLength!: number;
}

test('SQLite DDL: computed column rendered', () => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'Users');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
    { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
    {
      propertyName: 'nameLength',
      columnName: 'name_len',
      type: 'INTEGER',
      nullable: true,
      isComputed: true,
      computedExpression: 'length(name)'
    }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(User, c));
  MetadataStorage.addPrimaryKey(User, 'id');
  const meta = MetadataStorage.getEntity(User) as EntityMetadata;
  const ddl = new SQLiteDdlStrategy().generateCreateTableSql(meta);
  expect(ddl).toContain('name_len GENERATED ALWAYS AS (length(name)) VIRTUAL');
});
