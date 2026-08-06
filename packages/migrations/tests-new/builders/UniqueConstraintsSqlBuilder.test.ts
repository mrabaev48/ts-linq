import { createDdlStrategy } from '../../src/builders/ddl/DdlStrategyFactory';
import {
  buildAddUniqueConstraintSql as addFromBuilder,
  buildDropUniqueConstraintSql as dropFromBuilder,
  UniqueConstraintsSqlBuilder
} from '../../src/builders/UniqueConstraintsSqlBuilder';
import type { TableDiff } from '../../src/DiffTypes';
import {
  buildAddUniqueConstraintSql,
  buildCreateIndexSql,
  buildDropUniqueConstraintSql
} from '../../src/index';

/**
 * Unit + security contract for the consolidated unique-constraint SQL (migrations/task-7).
 * The builders moved from the deleted `MigrationHandlers` grab-bag into
 * `UniqueConstraintsSqlBuilder`. Output for ordinary names is unchanged; adversarial names
 * are escaped through the task-1 quoter (no quote-char break-out).
 */
describe('UniqueConstraintsSqlBuilder — non-adversarial output (unchanged)', () => {
  test('buildAddUniqueConstraintSql per dialect', () => {
    const uc = { name: 'AK_User_email', columns: ['email', 'tenant'] };
    expect(buildAddUniqueConstraintSql('postgresql', 'users', uc)).toBe(
      'ALTER TABLE "users" ADD CONSTRAINT "AK_User_email" UNIQUE ("email", "tenant")'
    );
    expect(buildAddUniqueConstraintSql('mysql', 'users', uc)).toBe(
      'ALTER TABLE `users` ADD UNIQUE KEY `AK_User_email` (`email`, `tenant`)'
    );
    expect(buildAddUniqueConstraintSql('mssql', 'users', uc)).toBe(
      'ALTER TABLE [users] ADD CONSTRAINT [AK_User_email] UNIQUE ([email], [tenant])'
    );
  });

  test('buildDropUniqueConstraintSql per dialect', () => {
    expect(buildDropUniqueConstraintSql('postgresql', 'users', 'AK_User_email')).toBe(
      'ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "AK_User_email"'
    );
    expect(buildDropUniqueConstraintSql('mysql', 'users', 'AK_User_email')).toBe(
      'ALTER TABLE `users` DROP INDEX `AK_User_email`'
    );
    expect(buildDropUniqueConstraintSql('mssql', 'users', 'AK_User_email')).toBe(
      'ALTER TABLE [users] DROP CONSTRAINT [AK_User_email]'
    );
  });
});

describe('UniqueConstraintsSqlBuilder — adversarial names are escaped (task-1)', () => {
  test('embedded quote chars cannot break out of the quoted identifier', () => {
    const pg = buildAddUniqueConstraintSql('postgresql', 'x"; DROP TABLE u;--', {
      name: 'c"d',
      columns: ['e"f']
    });
    expect(pg).toBe('ALTER TABLE "x""; DROP TABLE u;--" ADD CONSTRAINT "c""d" UNIQUE ("e""f")');

    const mysql = buildAddUniqueConstraintSql('mysql', 'x`; DROP TABLE u;--', {
      name: 'c`d',
      columns: ['e`f']
    });
    expect(mysql).toBe('ALTER TABLE `x``; DROP TABLE u;--` ADD UNIQUE KEY `c``d` (`e``f`)');

    const mssql = buildDropUniqueConstraintSql('mssql', 'tbl', 'n]; DROP TABLE u;--');
    expect(mssql).toBe('ALTER TABLE [tbl] DROP CONSTRAINT [n]]; DROP TABLE u;--]');
  });
});

describe('UniqueConstraintsSqlBuilder — class delegates to the consolidated functions', () => {
  test('create/drop emit the same SQL as the free functions', () => {
    const td: TableDiff = {
      table: 'users',
      uniqueConstraintCreates: [{ name: 'AK_User_email', columns: ['email'] }],
      uniqueConstraintDrops: ['AK_old']
    };
    const builder = new UniqueConstraintsSqlBuilder(createDdlStrategy('postgresql'));

    const created: string[] = [];
    builder.create(td, created);
    expect(created).toEqual([
      addFromBuilder('postgresql', 'users', td.uniqueConstraintCreates![0])
    ]);

    const dropped: string[] = [];
    builder.drop(td, dropped);
    expect(dropped).toEqual([dropFromBuilder('postgresql', 'users', 'AK_old')]);
  });
});

describe('public barrel surface is preserved', () => {
  test('the previously-exported names remain importable as functions', () => {
    expect(typeof buildAddUniqueConstraintSql).toBe('function');
    expect(typeof buildDropUniqueConstraintSql).toBe('function');
    expect(typeof buildCreateIndexSql).toBe('function');
  });
});
