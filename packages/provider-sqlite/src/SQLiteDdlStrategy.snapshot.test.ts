import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/core';
import { SQLiteDdlStrategy } from './SQLiteDdlStrategy';

class SnapUser {
  id!: number;
  a!: number;
  doubleA!: number;
}

test('SQLite DDL snapshot: computed VIRTUAL + defaults', () => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(SnapUser, 'users_snap');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
    { propertyName: 'a', columnName: 'a', type: 'INTEGER', nullable: false },
    {
      propertyName: 'doubleA',
      columnName: 'doubleA',
      type: 'INTEGER',
      nullable: true,
      isComputed: true,
      computedExpression: 'a * 2'
    }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(SnapUser, c));
  MetadataStorage.addPrimaryKey(SnapUser, 'id');
  const meta = MetadataStorage.getEntity(SnapUser) as EntityMetadata;
  const ddl = new SQLiteDdlStrategy().generateCreateTableSql(meta);
  expect(ddl).toMatchInlineSnapshot(
    `"CREATE TABLE IF NOT EXISTS users_snap (id INTEGER NOT NULL, a INTEGER NOT NULL, doubleA GENERATED ALWAYS AS (a * 2) VIRTUAL, PRIMARY KEY (id))"`
  );
});
