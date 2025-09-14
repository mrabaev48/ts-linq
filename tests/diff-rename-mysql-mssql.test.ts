import { generateMigrationFromDiff } from '../src/migrations/DialectMigrationSql';
import type { SchemaDiff, TableDiff } from '../src/migrations/DiffTypes';

describe('Rename column SQL (MySQL/MSSQL)', () => {
  it('mysql generates CHANGE COLUMN with mapped type', () => {
    const td: TableDiff = {
      table: 'Users',
      columnRenames: [{ from: 'fullname', to: 'name', toDef: { name: 'name', type: 'TEXT', nullable: false } }]
    };
    const diff: SchemaDiff = { tables: [td] };
    const { up } = generateMigrationFromDiff(diff, 'mysql');
    expect(up.join('\n')).toMatch(/ALTER TABLE `Users` CHANGE COLUMN `fullname` `name` TEXT/);
  });

  it('mssql uses sp_rename', () => {
    const td: TableDiff = {
      table: 'Users',
      columnRenames: [{ from: 'fullname', to: 'name' }]
    };
    const diff: SchemaDiff = { tables: [td] };
    const { up } = generateMigrationFromDiff(diff, 'mssql');
    expect(up.join('\n')).toMatch(/EXEC sp_rename 'Users.fullname', 'name', 'COLUMN'/);
  });
});


