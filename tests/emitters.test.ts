import { createEmitter } from '../src/migrations/emitters';

describe('Dialect emitters', () => {
  test('postgres q/dropIndex/alterType/alterNull', () => {
    const e = createEmitter('postgresql');
    expect(e.q('t')).toBe('"t"');
    expect(e.dropIndex('t', 'i')).toBe('DROP INDEX "i"');
    expect(e.alterType('t', 'c', 'INTEGER')).toBe('ALTER TABLE "t" ALTER COLUMN "c" TYPE INTEGER');
    expect(e.alterNull('t', 'c', true)).toBe('ALTER TABLE "t" ALTER COLUMN "c" DROP NOT NULL');
    // unique/check
    expect(e.createUniqueConstraint('t', { columns: ['c'] })).toBe('ALTER TABLE "t" ADD CONSTRAINT "UQ_t_c" UNIQUE ("c")');
    expect(e.dropUniqueConstraint('t', 'UQ')).toBe('ALTER TABLE "t" DROP CONSTRAINT "UQ"');
    expect(e.addCheckConstraint('t', { expression: 'c > 0' })).toBe('ALTER TABLE "t" ADD CHECK (c > 0)');
    expect(e.dropCheckConstraint('t', 'CK')).toBe('ALTER TABLE "t" DROP CONSTRAINT "CK"');
  });

  test('mysql q/dropIndex/alterType/addColumn/dropColumn', () => {
    const e = createEmitter('mysql');
    expect(e.q('t')).toBe('`t`');
    expect(e.dropIndex('t', 'i')).toBe('DROP INDEX `i` ON `t`');
    expect(e.alterType('t', 'c', 'INT')).toBe('ALTER TABLE `t` MODIFY COLUMN `c` INT');
    const add = e.addColumn('t', 'c', 'INT', false, 1);
    expect(add).toMatch('ALTER TABLE `t` ADD COLUMN `c` INT NOT NULL DEFAULT 1');
    expect(e.dropColumn('t', 'c')).toBe('ALTER TABLE `t` DROP COLUMN `c`');
    // unique/check
    expect(e.createUniqueConstraint('t', { columns: ['c'] })).toBe('ALTER TABLE `t` ADD CONSTRAINT `UQ_t_c` UNIQUE (`c`)');
    expect(e.dropUniqueConstraint('t', 'UQ')).toBe('ALTER TABLE `t` DROP INDEX `UQ`');
  });

  test('mssql q/dropIndex/alterType/addColumn/dropColumn', () => {
    const e = createEmitter('mssql');
    expect(e.q('t')).toBe('[t]');
    expect(e.dropIndex('t', 'i')).toBe('DROP INDEX [t].[i]');
    expect(e.alterType('t', 'c', 'INT')).toBe('ALTER TABLE [t] ALTER COLUMN [c] INT');
    const add = e.addColumn('t', 'c', 'INT', false, 1);
    expect(add).toMatch('ALTER TABLE [t] ADD [c] INT NOT NULL DEFAULT 1');
    expect(e.dropColumn('t', 'c')).toBe('ALTER TABLE [t] DROP COLUMN [c]');
    // unique/check
    expect(e.createUniqueConstraint('t', { columns: ['c'] })).toBe('ALTER TABLE [t] ADD CONSTRAINT [UQ_t_c] UNIQUE ([c])');
    expect(e.dropUniqueConstraint('t', 'UQ')).toBe('ALTER TABLE [t] DROP CONSTRAINT [UQ]');
    expect(e.addCheckConstraint('t', { expression: 'c > 0' })).toBe('ALTER TABLE [t] ADD CHECK (c > 0)');
    expect(e.dropCheckConstraint('t', 'CK')).toBe('ALTER TABLE [t] DROP CONSTRAINT [CK]');
  });

  test('sqlite nullability/type require rebuild', () => {
    const e = createEmitter('sqlite');
    expect(e.alterNull('t', 'c', false)).toMatch('requires rebuild');
    expect(e.alterType('t', 'c', 'INTEGER')).toMatch('requires rebuild');
  });
});


