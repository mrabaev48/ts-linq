import { DiffBasedMigration } from '../src/migrations/DiffBasedMigration';
import { Dialect } from '../src/migrations/DialectMigrationSql';
import { SchemaDiff } from '../src/migrations/DiffTypes';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';

class TestDiffMigration extends DiffBasedMigration {
  protected provider: SQLiteProvider;
  constructor(provider: SQLiteProvider) {
    super();
    this.provider = provider;
  }
  protected dialect(): Dialect {
    return 'sqlite';
  }
  protected diff(): SchemaDiff {
    return {
      tables: [
        {
          table: 't_new',
          create: {
            name: 't_new',
            columns: [{ name: 'id', type: 'INTEGER', nullable: false } as any],
            primaryKeys: ['id'],
            indexes: [],
            foreignKeys: []
          } as any
        }
      ]
    } as any;
  }
  protected get name() {
    return 'TestDiffMigration';
  }
  protected get version() {
    return '000-diff';
  }
}

describe('DiffBasedMigration', () => {
  test('executes generated SQL from diff', async () => {
    const p = new SQLiteProvider(':memory:');
    await p.connect();
    const m = new TestDiffMigration(p);
    await expect(m.up()).resolves.toBeUndefined();
    await p.disconnect();
  });

  test('hooks are called and allow skipping statements', async () => {
    const p = new SQLiteProvider(':memory:');
    await p.connect();
    const calls: string[] = [];
    class M extends TestDiffMigration {
      protected async beforeUp(sqls: string[]): Promise<void> {
        calls.push('beforeUp:' + sqls.length);
      }
      protected async afterUp(sqls: string[]): Promise<void> {
        calls.push('afterUp:' + sqls.length);
      }
      protected async beforeUpStatement(sql: string): Promise<boolean> {
        calls.push('beforeStmt');
        return !sql.includes('noop');
      }
      protected async afterUpStatement(sql: string): Promise<void> {
        calls.push('afterStmt');
      }
      protected diff(): SchemaDiff {
        return {
          tables: [
            {
              table: 'a',
              create: {
                name: 'a',
                columns: [{ name: 'id', type: 'INTEGER', nullable: false } as any],
                primaryKeys: ['id'],
                indexes: [],
                foreignKeys: []
              } as any
            }
          ]
        } as any;
      }
    }
    // Spy to inject a noop statement behavior by intercepting provider call
    const spy = jest
      .spyOn(p as any, 'executeNonQuery')
      .mockImplementation(async (...args: any[]) => {
        const sql = String(args[0]);
        if (sql.includes('CREATE TABLE') && Math.random() < -1) await Promise.resolve(); // never true
        return 0 as any;
      });
    const m = new M(p);
    await m.up();
    expect(calls[0]).toMatch(/^beforeUp/);
    expect(calls.some((c) => c === 'beforeStmt')).toBeTruthy();
    expect(calls.some((c) => c === 'afterStmt')).toBeTruthy();
    expect(calls[calls.length - 1]).toMatch(/^afterUp/);
    spy.mockRestore();
    await p.disconnect();
  });
});
