'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const MetadataStorage_1 = require('../../src/metadata/MetadataStorage');
class User {}
test('Index metadata registration (prod-ready, without relying on decorator timing)', () => {
  MetadataStorage_1.MetadataStorage.getInstance().clear();
  // Register minimal entity and columns
  MetadataStorage_1.MetadataStorage.addEntity(User, 'Users');
  const cols = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
    { propertyName: 'active', columnName: 'active', type: 'INTEGER', nullable: false }
  ];
  cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(User, c));
  MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
  // Register index explicitly
  const idx = {
    name: 'idx_users_active',
    columns: ['active'],
    unique: false,
    where: 'active = 1'
  };
  MetadataStorage_1.MetadataStorage.addIndex(User, idx);
  const meta = MetadataStorage_1.MetadataStorage.getEntity(User);
  expect(meta.indexes.length).toBeGreaterThan(0);
  expect(meta.indexes[0].name).toBe('idx_users_active');
  expect(meta.indexes[0].where).toBe('active = 1');
});
//# sourceMappingURL=Index.test.js.map
