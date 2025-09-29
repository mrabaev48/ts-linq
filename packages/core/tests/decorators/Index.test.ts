import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { ColumnMetadata, IndexMetadata } from '../../src/types';

class User {
  id!: number;
  active!: number;
}

test('Index metadata registration (prod-ready, without relying on decorator timing)', () => {
  MetadataStorage.getInstance().clear();
  // Register minimal entity and columns
  MetadataStorage.addEntity(User, 'Users');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
    { propertyName: 'active', columnName: 'active', type: 'INTEGER', nullable: false }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(User, c));
  MetadataStorage.addPrimaryKey(User, 'id');

  // Register index explicitly
  const idx: IndexMetadata = {
    name: 'idx_users_active',
    columns: ['active'],
    unique: false,
    where: 'active = 1'
  };
  MetadataStorage.addIndex(User, idx);

  const meta = MetadataStorage.getEntity(User)!;
  expect(meta.indexes.length).toBeGreaterThan(0);
  expect(meta.indexes[0].name).toBe('idx_users_active');
  expect(meta.indexes[0].where).toBe('active = 1');
});
