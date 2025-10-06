'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const DiffTypes_1 = require('../../src/migrations/DiffTypes');
test('compareSchemas: detects index creates/drops and where/unique/columns changes', () => {
  const expected = {
    tables: [
      {
        name: 'Users',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false },
          { name: 'active', type: 'INTEGER', nullable: false }
        ],
        primaryKeys: ['id'],
        indexes: [
          { name: 'idx_users_active', columns: ['active'], unique: false, where: 'active = 1' }
        ],
        foreignKeys: []
      }
    ]
  };
  const actual = {
    tables: [
      {
        name: 'Users',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false },
          { name: 'active', type: 'INTEGER', nullable: false }
        ],
        primaryKeys: ['id'],
        indexes: [{ name: 'idx_users_active', columns: ['active'], unique: false }],
        foreignKeys: []
      }
    ]
  };
  const diff = (0, DiffTypes_1.compareSchemas)(expected, actual);
  const td = diff.tables.find((t) => t.table === 'Users');
  expect(td.indexCreates).toBeDefined();
  expect(td.indexCreates[0].name).toBe('idx_users_active');
});
//# sourceMappingURL=DiffTypes.test.js.map
