import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/core';
import { PostgresDdlStrategy } from './PostgresDdlStrategy';

class SnapUser { id!: number; name!: string; nameLength!: number; createdAt!: Date }

test('PG DDL snapshot: computed + defaults', () => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(SnapUser, 'users_snap');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
    { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
    { propertyName: 'createdAt', columnName: 'created_at', type: 'DATETIME', nullable: false, defaultExpression: 'CURRENT_TIMESTAMP' },
    { propertyName: 'nameLength', columnName: 'name_len', type: 'INTEGER', nullable: true, isComputed: true, computedExpression: 'length(name)' }
  ];
  cols.forEach(c => MetadataStorage.addColumn(SnapUser, c));
  MetadataStorage.addPrimaryKey(SnapUser, 'id');
  const meta = MetadataStorage.getEntity(SnapUser) as EntityMetadata;
  const ddl = new PostgresDdlStrategy().generateCreateTableSql(meta);
  expect(ddl).toMatchInlineSnapshot(`"CREATE TABLE IF NOT EXISTS \"users_snap\" (\"id\" INTEGER NOT NULL, \"name\" TEXT NOT NULL, \"created_at\" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, \"name_len\" INTEGER GENERATED ALWAYS AS (length(name)) STORED, PRIMARY KEY (\"id\"))"`);
});


