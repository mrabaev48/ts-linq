import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/core';
import { PostgresDdlStrategy } from './PostgresDdlStrategy';

class User {
  id!: number;
  name!: string;
  nameLength!: number;
}

test('Postgres DDL: computed column rendered', () => {
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
  const ddl = new PostgresDdlStrategy().generateCreateTableSql(meta);
  expect(ddl).toContain('"name_len" INTEGER GENERATED ALWAYS AS (length(name)) STORED');
});

test('Postgres DDL: defaultExpression rendered', () => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'Users');
  MetadataStorage.addColumn(User, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: true
  });
  MetadataStorage.addColumn(User, {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT',
    nullable: false
  });
  MetadataStorage.addColumn(User, {
    propertyName: 'createdAt',
    columnName: 'created_at',
    type: 'DATETIME',
    nullable: false,
    defaultExpression: 'CURRENT_TIMESTAMP'
  });
  MetadataStorage.addPrimaryKey(User, 'id');
  const meta = MetadataStorage.getEntity(User) as EntityMetadata;
  const ddl = new PostgresDdlStrategy().generateCreateTableSql(meta);
  expect(ddl).toContain('"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP');
});
