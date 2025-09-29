import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/core';
import { MssqlDdlStrategy } from './MssqlDdlStrategy';

class SnapUser {
  id!: number;
  a!: number;
  doubleA!: number;
}

test('MSSQL DDL snapshot: computed PERSISTED', () => {
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
  const ddl = new MssqlDdlStrategy().generateCreateTableSql(meta);
  expect(ddl).toMatchInlineSnapshot(
    `"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users_snap') BEGIN CREATE TABLE users_snap (id INT NOT NULL, a INT NOT NULL, doubleA AS (a * 2), PRIMARY KEY (id)) END"`
  );
});
