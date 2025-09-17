import { MySqlProvider } from '@ts-linq/mysql';
import { DbContext } from '@ts-linq/core';

// Gated by RUN_DB_TESTS
const run = !!process.env.RUN_DB_TESTS;


(run ? describe : describe.skip)('MySQL JSON integration', () => {
  class Ctx extends DbContext {
    constructor(conn: string) { super({ provider: new MySqlProvider(conn) }); }
  }

  test('JSON_EXTRACT parameterized select', async () => {
    const conn = process.env.MYSQL_URL || 'mysql://root:test@localhost:3306/testdb';
    const ctx = new Ctx(conn);
    await ctx.ensureCreated();
    try {
      const res = await (ctx as any).provider.executeQuery(
        'SELECT JSON_EXTRACT(CAST(? AS JSON), ?) as v',
        ['{"a":{"b":1}}', '$.a.b']
      );
      expect(res).toBeDefined();
    } finally {
      await ctx.dispose();
    }
  });
});


