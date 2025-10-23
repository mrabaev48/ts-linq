import 'reflect-metadata';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { ColumnMetadata } from '../../src/types';

class User {
  id!: number;
  name!: string;
  nameLength!: number;
}

describe('ComputedColumn metadata registration', () => {
  test('stores computed column flags and expression in metadata', () => {
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

    const meta = MetadataStorage.getEntity(User);
    expect(meta).toBeDefined();
    const cc = meta!.columns.find((c) => c.propertyName === 'nameLength');
    expect(cc?.isComputed).toBe(true);
    expect(cc?.computedExpression).toBe('length(name)');
  });
});
