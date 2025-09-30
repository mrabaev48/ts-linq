import { generateMigrationFromDiff } from '../../src/migrations/DialectMigrationSql';

test('Columns: alter type and nullability in Postgres', () => {
  const diff = {
    tables: [
      {
        table: 'Users',
        columnChanges: [
          {
            kind: 'alter',
            column: { name: 'age', type: 'INTEGER', nullable: false },
            prev: { name: 'age', type: 'TEXT', nullable: true }
          }
        ]
      }
    ]
  } as const;
  const res = generateMigrationFromDiff(diff as any, 'postgresql').up.join('\n');
  expect(res).toContain('ALTER TABLE "Users" ALTER COLUMN "age" TYPE INTEGER');
  expect(res).toContain('ALTER TABLE "Users" ALTER COLUMN "age" SET NOT NULL');
});

test('Columns: computed column add for MSSQL', () => {
  const diff = {
    tables: [
      {
        table: 'Users',
        columnChanges: [
          {
            kind: 'add',
            column: {
              name: 'fullName',
              type: 'TEXT',
              nullable: true,
              isComputed: true,
              computedExpression: "([first] + ' ' + [last])",
              computedStorage: 'PERSISTED'
            }
          }
        ]
      }
    ]
  } as const;
  const res = generateMigrationFromDiff(diff as any, 'mssql').up.join('\n');
  expect(res).toContain(
    "ALTER TABLE [Users] ADD [fullName] AS (([first] + ' ' + [last])) PERSISTED"
  );
});
