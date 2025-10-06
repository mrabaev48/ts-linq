import { SQLiteProvider } from '../src';
import { MetadataStorage, type ColumnMetadata } from '@ts-linq/core';

class E {
  id!: number;
  name!: string;
}

beforeEach(() => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(E, 'e');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
    { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(E, c));
  MetadataStorage.addPrimaryKey(E, 'id');
});

test('connect/disconnect does not throw on :memory:', async () => {
  const p = new SQLiteProvider(':memory:');
  await p.connect();
  await p.disconnect();
});
