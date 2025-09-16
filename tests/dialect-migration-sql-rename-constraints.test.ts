import { generateMigrationFromDiff, type Dialect } from '../src/migrations/DialectMigrationSql';
import type { SchemaDiff } from '../src/migrations/DiffTypes';

describe('MigrationSqlBuilder: rename constraints', () => {
  const makeDiff = (): SchemaDiff => ({
    tables: [
      {
        table: 'T',
        uniqueRenames: [{ from: 'UQ_old', to: 'UQ_new' }],
        checkRenames: [{ from: 'CK_old', to: 'CK_new' }]
      }
    ]
  });

  test('postgres: uses RENAME CONSTRAINT', () => {
    const { up } = generateMigrationFromDiff(makeDiff(), 'postgresql' as Dialect);
    expect(up.some((s) => /ALTER TABLE "T" RENAME CONSTRAINT "UQ_old" TO "UQ_new"/.test(s))).toBe(
      true
    );
    expect(up.some((s) => /ALTER TABLE "T" RENAME CONSTRAINT "CK_old" TO "CK_new"/.test(s))).toBe(
      true
    );
  });

  test('mssql: uses sp_rename', () => {
    const { up } = generateMigrationFromDiff(makeDiff(), 'mssql' as Dialect);
    expect(up.some((s) => /EXEC sp_rename 'T.UQ_old', 'UQ_new', 'OBJECT'/.test(s))).toBe(true);
    expect(up.some((s) => /EXEC sp_rename 'T.CK_old', 'CK_new', 'OBJECT'/.test(s))).toBe(true);
  });
});


