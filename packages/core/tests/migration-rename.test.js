'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const MigrationBuilder_1 = require('../src/migrations/MigrationBuilder');
const DialectMigrationSql_1 = require('../src/migrations/DialectMigrationSql');
describe('Rename table/column', () => {
  test('table rename per dialect', () => {
    const mb = new MigrationBuilder_1.MigrationBuilder().renameTable('a', 'b');
    const diff = mb.toDiff();
    expect(
      (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql').up[0]
    ).toContain('RENAME TO');
    expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql').up[0]).toContain(
      'RENAME TABLE'
    );
    expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mssql').up[0]).toContain(
      'sp_rename'
    );
  });
  test('column rename emits dialect-specific SQL/comments', () => {
    const mb = new MigrationBuilder_1.MigrationBuilder().renameColumn('t', 'old', 'new');
    const upPg = (0, DialectMigrationSql_1.generateMigrationFromDiff)(mb.toDiff(), 'postgresql').up;
    expect(upPg.some((s) => s.includes('RENAME COLUMN'))).toBeTruthy();
    const upMy = (0, DialectMigrationSql_1.generateMigrationFromDiff)(mb.toDiff(), 'mysql').up;
    expect(upMy.some((s) => s.startsWith('-- MySQL requires full type'))).toBeTruthy();
    const upSqlite = (0, DialectMigrationSql_1.generateMigrationFromDiff)(mb.toDiff(), 'sqlite').up;
    expect(upSqlite.some((s) => s.startsWith('-- SQLite column rename'))).toBeTruthy();
  });
});
//# sourceMappingURL=migration-rename.test.js.map
