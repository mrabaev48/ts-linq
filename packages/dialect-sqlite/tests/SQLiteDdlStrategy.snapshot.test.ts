import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/core';
import { SQLiteDdlStrategy } from '../src';

class User { id!: number; title!: string; nameLength!: number }

beforeEach(() => { MetadataStorage.getInstance().clear(); });

test('SQLite DDL snapshot: computed + PK', () => {
  MetadataStorage.addEntity(User, 'users');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
    { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: false },
    { propertyName: 'nameLength', columnName: 'name_len', type: 'INTEGER', nullable: true, isComputed: true, computedExpression: 'length(title)' }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(User, c));
  MetadataStorage.addPrimaryKey(User, 'id');
  const meta = MetadataStorage.getEntity(User) as EntityMetadata;
  const ddl = new SQLiteDdlStrategy().generateCreateTableSql(meta);
  expect(ddl).toMatchInlineSnapshot(
    `"CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, name_len GENERATED ALWAYS AS (length(title)) VIRTUAL)"`
  );
});


