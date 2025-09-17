import { MySqlProvider } from '@ts-linq/mysql';
import { DbContext } from '@ts-linq/core';

// Gated by RUN_DB_TESTS
const run = !!process.env.RUN_DB_TESTS;

(run ? describe : describe.skip)('MySQL JSON integration', () => {
  class Ctx extends DbContext {
    constructor(conn: string) { super(new MySqlProvider(conn)); }
  }

  test('JSON_EXTRACT parameterized select', async () => {
    const conn = process.env.MYSQL_URL || 'mysql://root:root@localhost:3306/test';
    const ctx = new Ctx(conn);
    await ctx.connect();
    try {
      const res = await (ctx as any).provider.executeQuery(
        'SELECT JSON_EXTRACT(?) as v',
        ['{"a":{"b":1}}']
      );
      expect(res).toBeDefined();
    } finally {
      await ctx.dispose();
    }
  });
});


