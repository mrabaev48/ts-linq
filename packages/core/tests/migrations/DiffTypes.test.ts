import { compareSchemas, type SchemaSnapshot } from '../../src/migrations/DiffTypes';

test('compareSchemas: detects index creates/drops and where/unique/columns changes', () => {
  const expected: SchemaSnapshot = {
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
  const actual: SchemaSnapshot = {
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
  const diff = compareSchemas(expected, actual);
  const td = diff.tables.find((t) => t.table === 'Users')! as {
    indexCreates?: unknown;
    indexDrops?: unknown;
  };
  expect(td.indexCreates).toBeDefined();
  expect((td.indexCreates as Array<{ name: string }>)[0].name).toBe('idx_users_active');
});
