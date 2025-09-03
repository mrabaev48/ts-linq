import 'reflect-metadata';
import { generateMigrationFromDiff } from '../src/migrations/DialectMigrationSql';
import { SchemaDiff } from '../src/migrations/DiffTypes';

const baseDiff: SchemaDiff = {
  tables: [
    {
      table: 'Users',
      columnChanges: [
        { kind: 'add', column: { name: 'age', type: 'INTEGER', nullable: true } as any },
      ]
    }
  ]
};

describe('Dialect migration SQL', () => {
  it('postgresql add column + create table snapshot', () => {
    const diff: SchemaDiff = {
      tables: [
        { table: 'Users', create: { name: 'Users', columns: [{ name: 'id', type: 'INTEGER', nullable: false } as any], primaryKeys: ['id'], indexes: [], foreignKeys: [] } as any },
        ...baseDiff.tables
      ]
    };
    const { up } = generateMigrationFromDiff(diff, 'postgresql');
    const expected = 'CREATE TABLE IF NOT EXISTS "Users" ("id" INTEGER NOT NULL, PRIMARY KEY ("id"))\nALTER TABLE "Users" ADD COLUMN "age" INTEGER';
    expect(up.join('\n')).toBe(expected);
  });

  it('mysql add column', () => {
    const { up } = generateMigrationFromDiff(baseDiff, 'mysql');
    expect(up[0]).toBe('ALTER TABLE `Users` ADD COLUMN `age` INT');
  });

  it('mssql add column', () => {
    const { up } = generateMigrationFromDiff(baseDiff, 'mssql');
    expect(up[0]).toBe('ALTER TABLE [Users] ADD [age] INT');
  });

  it('alter type/null (postgresql)', () => {
    const diff: SchemaDiff = {
      tables: [{ table: 'Users', columnChanges: [ { kind: 'alter', column: { name: 'age', type: 'TEXT', nullable: false } as any, prev: { name: 'age', type: 'INTEGER', nullable: true } as any } ] }]
    };
    const { up } = generateMigrationFromDiff(diff, 'postgresql');
    expect(up).toEqual([
      'ALTER TABLE "Users" ALTER COLUMN "age" TYPE TEXT',
      'ALTER TABLE "Users" ALTER COLUMN "age" SET NOT NULL'
    ]);
  });

  it('FK in CREATE TABLE (postgresql)', () => {
    const diff: SchemaDiff = { tables: [{ table: 'Orders', create: { name: 'Orders', columns: [{ name: 'id', type: 'INTEGER', nullable: false } as any, { name: 'userId', type: 'INTEGER', nullable: false } as any], primaryKeys: ['id'], indexes: [], foreignKeys: [{ columns: ['userId'], refTable: 'Users', refColumns: ['id'] }] } as any }] };
    const { up } = generateMigrationFromDiff(diff, 'postgresql');
    expect(up[0]).toBe('CREATE TABLE IF NOT EXISTS "Orders" ("id" INTEGER NOT NULL, "userId" INTEGER NOT NULL, PRIMARY KEY ("id"), FOREIGN KEY ("userId") REFERENCES "Users" ("id"))');
  });
});


