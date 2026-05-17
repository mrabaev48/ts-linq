import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DatabaseProvider } from '@ts-linq/core';

import type { Dialect } from '../src/DialectMigrationSql';
import { DiffBasedMigration } from '../src/DiffBasedMigration';
import type { SchemaDiff } from '../src/DiffTypes';

jest.mock('../src/DialectMigrationSql', () => ({
  generateMigrationFromDiff: jest.fn((diff: SchemaDiff, dialect: Dialect) => {
    const upStatements: string[] = [];
    const downStatements: string[] = [];

    for (const table of diff.tables) {
      if (table.create) {
        upStatements.push(`CREATE TABLE ${table.table} (id INTEGER)`);
        downStatements.push(`DROP TABLE ${table.table}`);
      }
      if (table.drop) {
        upStatements.push(`DROP TABLE ${table.table}`);
        downStatements.push(`CREATE TABLE ${table.table} (id INTEGER)`);
      }
      if (table.columnChanges) {
        for (const change of table.columnChanges) {
          if (change.kind === 'add') {
            upStatements.push(`ALTER TABLE ${table.table} ADD COLUMN ${change.column.name}`);
            downStatements.push(`ALTER TABLE ${table.table} DROP COLUMN ${change.column.name}`);
          }
        }
      }
    }

    return { up: upStatements, down: downStatements };
  })
}));

function createMockProvider(): DatabaseProvider {
  const executedStatements: string[] = [];

  return {
    executeNonQuery: jest.fn(async (sql: string): Promise<number> => {
      executedStatements.push(sql);
      return 1;
    }) as DatabaseProvider['executeNonQuery'],
    executeQuery: jest.fn(async () => []),
    beginTransaction: jest.fn(async () => {}),
    commitTransaction: jest.fn(async () => {}),
    rollbackTransaction: jest.fn(async () => {}),
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    getDatabaseName: jest.fn(() => 'test'),
    getSqlDialect: jest.fn(),
    _getExecutedStatements: () => executedStatements
  } as unknown as DatabaseProvider;
}

class TestDiffMigration extends DiffBasedMigration {
  protected provider: DatabaseProvider;
  private _diff: SchemaDiff;
  private _dialect: Dialect;

  public beforeUpCalls: string[][] = [];
  public afterUpCalls: string[][] = [];
  public beforeUpStatementCalls: string[] = [];
  public afterUpStatementCalls: string[] = [];
  public beforeDownCalls: string[][] = [];
  public afterDownCalls: string[][] = [];
  public beforeDownStatementCalls: string[] = [];
  public afterDownStatementCalls: string[] = [];

  constructor(provider: DatabaseProvider, diff: SchemaDiff, dialect: Dialect = 'postgresql') {
    super();
    this.provider = provider;
    this._diff = diff;
    this._dialect = dialect;
  }

  protected get name(): string {
    return 'TestDiffMigration';
  }

  protected get version(): string {
    return '001';
  }

  protected dialect(): Dialect {
    return this._dialect;
  }

  protected diff(): SchemaDiff {
    return this._diff;
  }

  protected beforeUp(sqls: string[]): void {
    this.beforeUpCalls.push([...sqls]);
  }

  protected afterUp(sqls: string[]): void {
    this.afterUpCalls.push([...sqls]);
  }

  protected beforeUpStatement(sql: string): boolean {
    this.beforeUpStatementCalls.push(sql);
    return true;
  }

  protected afterUpStatement(sql: string): void {
    this.afterUpStatementCalls.push(sql);
  }

  protected beforeDown(sqls: string[]): void {
    this.beforeDownCalls.push([...sqls]);
  }

  protected afterDown(sqls: string[]): void {
    this.afterDownCalls.push([...sqls]);
  }

  protected beforeDownStatement(sql: string): boolean {
    this.beforeDownStatementCalls.push(sql);
    return true;
  }

  protected afterDownStatement(sql: string): void {
    this.afterDownStatementCalls.push(sql);
  }
}

describe('DiffBasedMigration', () => {
  let provider: DatabaseProvider;

  beforeEach(() => {
    provider = createMockProvider();
  });

  describe('up()', () => {
    it('should execute up statements from diff', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.up();

      expect(provider.executeNonQuery).toHaveBeenCalledWith('CREATE TABLE users (id INTEGER)');
    });

    it('should call beforeUp hook', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.up();

      expect(migration.beforeUpCalls).toHaveLength(1);
      expect(migration.beforeUpCalls[0]).toEqual(['CREATE TABLE users (id INTEGER)']);
    });

    it('should call afterUp hook', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.up();

      expect(migration.afterUpCalls).toHaveLength(1);
      expect(migration.afterUpCalls[0]).toEqual(['CREATE TABLE users (id INTEGER)']);
    });

    it('should call beforeUpStatement for each statement', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          },
          {
            table: 'posts',
            create: { name: 'posts', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.up();

      expect(migration.beforeUpStatementCalls).toEqual([
        'CREATE TABLE users (id INTEGER)',
        'CREATE TABLE posts (id INTEGER)'
      ]);
    });

    it('should call afterUpStatement for each statement', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          },
          {
            table: 'posts',
            create: { name: 'posts', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.up();

      expect(migration.afterUpStatementCalls).toEqual([
        'CREATE TABLE users (id INTEGER)',
        'CREATE TABLE posts (id INTEGER)'
      ]);
    });

    it('should call hooks in correct order', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const callOrder: string[] = [];

      class OrderedMigration extends TestDiffMigration {
        protected beforeUp(sqls: string[]): void {
          super.beforeUp(sqls);
          callOrder.push('beforeUp');
        }

        protected beforeUpStatement(sql: string): boolean {
          super.beforeUpStatement(sql);
          callOrder.push('beforeUpStatement');
          return true;
        }

        protected afterUpStatement(sql: string): void {
          super.afterUpStatement(sql);
          callOrder.push('afterUpStatement');
        }

        protected afterUp(sqls: string[]): void {
          super.afterUp(sqls);
          callOrder.push('afterUp');
        }
      }

      const migration = new OrderedMigration(provider, diff);
      await migration.up();

      expect(callOrder).toEqual(['beforeUp', 'beforeUpStatement', 'afterUpStatement', 'afterUp']);
    });

    it('should skip statement when beforeUpStatement returns false', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          },
          {
            table: 'posts',
            create: { name: 'posts', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      class SkippingMigration extends TestDiffMigration {
        protected beforeUpStatement(sql: string): boolean {
          super.beforeUpStatement(sql);
          return !sql.includes('posts');
        }
      }

      const migration = new SkippingMigration(provider, diff);
      await migration.up();

      const mockProvider = provider as unknown as { _getExecutedStatements: () => string[] };
      const executed = mockProvider._getExecutedStatements();

      expect(executed).toEqual(['CREATE TABLE users (id INTEGER)']);
      expect(executed).not.toContain('CREATE TABLE posts (id INTEGER)');
    });

    it('should handle multiple column changes', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            columnChanges: [
              { kind: 'add' as const, column: { name: 'email', type: 'VARCHAR', nullable: true } },
              { kind: 'add' as const, column: { name: 'age', type: 'INTEGER', nullable: true } }
            ]
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.up();

      expect(provider.executeNonQuery).toHaveBeenCalledTimes(2);
    });

    it('should pass dialect to generator', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff, 'postgresql');
      await migration.up();

      const { generateMigrationFromDiff } = require('../src/DialectMigrationSql');
      expect(generateMigrationFromDiff).toHaveBeenCalledWith(diff, 'postgresql');
    });
  });

  describe('down()', () => {
    it('should execute down statements from diff', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.down();

      expect(provider.executeNonQuery).toHaveBeenCalledWith('DROP TABLE users');
    });

    it('should call beforeDown hook', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.down();

      expect(migration.beforeDownCalls).toHaveLength(1);
      expect(migration.beforeDownCalls[0]).toEqual(['DROP TABLE users']);
    });

    it('should call afterDown hook', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.down();

      expect(migration.afterDownCalls).toHaveLength(1);
      expect(migration.afterDownCalls[0]).toEqual(['DROP TABLE users']);
    });

    it('should call beforeDownStatement for each statement', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          },
          {
            table: 'posts',
            create: { name: 'posts', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.down();

      expect(migration.beforeDownStatementCalls).toEqual(['DROP TABLE users', 'DROP TABLE posts']);
    });

    it('should call afterDownStatement for each statement', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          },
          {
            table: 'posts',
            create: { name: 'posts', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.down();

      expect(migration.afterDownStatementCalls).toEqual(['DROP TABLE users', 'DROP TABLE posts']);
    });

    it('should call hooks in correct order', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const callOrder: string[] = [];

      class OrderedMigration extends TestDiffMigration {
        protected beforeDown(sqls: string[]): void {
          super.beforeDown(sqls);
          callOrder.push('beforeDown');
        }

        protected beforeDownStatement(sql: string): boolean {
          super.beforeDownStatement(sql);
          callOrder.push('beforeDownStatement');
          return true;
        }

        protected afterDownStatement(sql: string): void {
          super.afterDownStatement(sql);
          callOrder.push('afterDownStatement');
        }

        protected afterDown(sqls: string[]): void {
          super.afterDown(sqls);
          callOrder.push('afterDown');
        }
      }

      const migration = new OrderedMigration(provider, diff);
      await migration.down();

      expect(callOrder).toEqual([
        'beforeDown',
        'beforeDownStatement',
        'afterDownStatement',
        'afterDown'
      ]);
    });

    it('should skip statement when beforeDownStatement returns false', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          },
          {
            table: 'posts',
            create: { name: 'posts', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      class SkippingMigration extends TestDiffMigration {
        protected beforeDownStatement(sql: string): boolean {
          super.beforeDownStatement(sql);
          return !sql.includes('posts');
        }
      }

      const migration = new SkippingMigration(provider, diff);
      await migration.down();

      const mockProvider = provider as unknown as { _getExecutedStatements: () => string[] };
      const executed = mockProvider._getExecutedStatements();

      expect(executed).toEqual(['DROP TABLE users']);
      expect(executed).not.toContain('DROP TABLE posts');
    });
  });

  describe('async diff', () => {
    it('should support async diff method', async () => {
      class AsyncDiffMigration extends DiffBasedMigration {
        protected provider: DatabaseProvider;

        constructor(provider: DatabaseProvider) {
          super();
          this.provider = provider;
        }

        protected get name(): string {
          return 'AsyncTest';
        }

        protected get version(): string {
          return '001';
        }

        protected dialect(): Dialect {
          return 'postgresql';
        }

        protected async diff(): Promise<SchemaDiff> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            tables: [
              {
                table: 'users',
                create: {
                  name: 'users',
                  columns: [],
                  primaryKeys: [],
                  indexes: [],
                  foreignKeys: []
                }
              }
            ]
          };
        }
      }

      const migration = new AsyncDiffMigration(provider);
      await migration.up();

      expect(provider.executeNonQuery).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty diff', async () => {
      const diff: SchemaDiff = { tables: [] };

      const migration = new TestDiffMigration(provider, diff);
      await migration.up();
      await migration.down();

      expect(migration.beforeUpCalls).toHaveLength(1);
      expect(migration.beforeUpCalls[0]).toEqual([]);
      expect(migration.beforeDownCalls).toHaveLength(1);
      expect(migration.beforeDownCalls[0]).toEqual([]);
    });

    it('should handle diff with no changes', async () => {
      const diff: SchemaDiff = {
        tables: [{ table: 'users', columnChanges: [] }]
      };

      const migration = new TestDiffMigration(provider, diff);
      await migration.up();

      expect(provider.executeNonQuery).not.toHaveBeenCalled();
    });

    it('should preserve hook execution even when skipping statements', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      class AllSkippingMigration extends TestDiffMigration {
        protected beforeUpStatement(sql: string): boolean {
          super.beforeUpStatement(sql);
          return false;
        }
      }

      const migration = new AllSkippingMigration(provider, diff);
      await migration.up();

      expect(migration.beforeUpCalls).toHaveLength(1);
      expect(migration.beforeUpStatementCalls).toHaveLength(1);
      expect(migration.afterUpStatementCalls).toHaveLength(0);
      expect(migration.afterUpCalls).toHaveLength(1);
    });
  });

  describe('integration with Migration base', () => {
    it('should expose name and version from base class', () => {
      const diff: SchemaDiff = { tables: [] };
      const migration = new TestDiffMigration(provider, diff);

      expect(migration.getName()).toBe('TestDiffMigration');
      expect(migration.getVersion()).toBe('001');
    });

    it('should implement up/down as required by Migration', async () => {
      const diff: SchemaDiff = {
        tables: [
          {
            table: 'users',
            create: { name: 'users', columns: [], primaryKeys: [], indexes: [], foreignKeys: [] }
          }
        ]
      };

      const migration = new TestDiffMigration(provider, diff);

      await expect(migration.up()).resolves.not.toThrow();
      await expect(migration.down()).resolves.not.toThrow();
    });
  });
});
