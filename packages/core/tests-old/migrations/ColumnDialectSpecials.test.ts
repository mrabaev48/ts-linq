import { generateMigrationFromDiff } from '../../src/migrations/DialectMigrationSql';

test('MySQL alter nullability requires full type comment', () => {
  const diff = {
    tables: [
      {
        table: 'Users',
        columnChanges: [
          {
            kind: 'alter',
            column: { name: 'age', type: 'INTEGER', nullable: false },
            prev: { name: 'age', type: 'INTEGER', nullable: true }
          }
        ]
      }
    ]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'mysql').up.join('\n');
  expect(sql).toContain('MySQL requires full type in MODIFY for nullability');
});

test('MSSQL alter nullability requires full type comment', () => {
  const diff = {
    tables: [
      {
        table: 'Users',
        columnChanges: [
          {
            kind: 'alter',
            column: { name: 'age', type: 'INTEGER', nullable: true },
            prev: { name: 'age', type: 'INTEGER', nullable: false }
          }
        ]
      }
    ]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'mssql').up.join('\n');
  expect(sql).toContain('MSSQL requires full type in ALTER COLUMN for nullability');
});

test('MySQL column rename emits comment about CHANGE COLUMN', () => {
  const diff = {
    tables: [
      {
        table: 'Users',
        columnRenames: [{ from: 'oldCol', to: 'newCol' }]
      }
    ]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'mysql').up.join('\n');
  expect(sql).toContain('MySQL requires full type for CHANGE COLUMN');
});

test('SQLite drop column emits not supported comment', () => {
  const diff = {
    tables: [
      {
        table: 'Users',
        columnChanges: [{ kind: 'drop', column: { name: 'age', type: 'INTEGER', nullable: true } }]
      }
    ]
  } as const;
  const sql = generateMigrationFromDiff(diff as any, 'sqlite').up.join('\n');
  expect(sql).toContain('DROP COLUMN');
  expect(sql).toContain('not supported');
});
