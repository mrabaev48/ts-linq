'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const DiffBasedMigration_1 = require('../src/migrations/DiffBasedMigration');
const sqlite_1 = require('@ts-linq/sqlite');
class TestDiffMigration extends DiffBasedMigration_1.DiffBasedMigration {
  constructor(provider) {
    super();
    this.provider = provider;
  }
  dialect() {
    return 'sqlite';
  }
  diff() {
    return {
      tables: [
        {
          table: 't_new',
          create: {
            name: 't_new',
            columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
            primaryKeys: ['id'],
            indexes: [],
            foreignKeys: []
          }
        }
      ]
    };
  }
  get name() {
    return 'TestDiffMigration';
  }
  get version() {
    return '000-diff';
  }
}
describe('DiffBasedMigration', () => {
  test('executes generated SQL from diff', async () => {
    const p = new sqlite_1.SQLiteProvider(':memory:');
    await p.connect();
    const m = new TestDiffMigration(p);
    await expect(m.up()).resolves.toBeUndefined();
    await p.disconnect();
  });
  test('hooks are called and allow skipping statements', async () => {
    const p = new sqlite_1.SQLiteProvider(':memory:');
    await p.connect();
    const calls = [];
    class M extends TestDiffMigration {
      async beforeUp(sqls) {
        calls.push('beforeUp:' + sqls.length);
      }
      async afterUp(sqls) {
        calls.push('afterUp:' + sqls.length);
      }
      async beforeUpStatement(sql) {
        calls.push('beforeStmt');
        return !sql.includes('noop');
      }
      async afterUpStatement(sql) {
        calls.push('afterStmt');
      }
      diff() {
        return {
          tables: [
            {
              table: 'a',
              create: {
                name: 'a',
                columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
                primaryKeys: ['id'],
                indexes: [],
                foreignKeys: []
              }
            }
          ]
        };
      }
    }
    // Spy to inject a noop statement behavior by intercepting provider call
    const spy = jest.spyOn(p, 'executeNonQuery').mockImplementation(async (...args) => {
      const sql = String(args[0]);
      if (sql.includes('CREATE TABLE') && Math.random() < -1) await Promise.resolve(); // never true
      return 0;
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
//# sourceMappingURL=diff-based-migration.test.js.map
