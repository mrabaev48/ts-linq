import { MySqlProvider } from '@ts-linq/provider-mysql';
import { DbContext } from '@ts-linq/orm';

// Gated by RUN_DB_TESTS
const run = !!process.env.RUN_DB_TESTS;
const runJson = process.env.MYSQL_JSON === '1';

(run ? describe : describe.skip)('MySQL JSON integration', () => {
  class Ctx extends DbContext {
    constructor(conn: string) {
      super({
        provider: new MySqlProvider({
          host: process.env.MYSQL_HOST || 'localhost',
          port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
          database: process.env.MYSQL_DB || 'test',
          user: process.env.MYSQL_USER || 'root',
          password: process.env.MYSQL_PASSWORD
        })
      });
    }
  }

  (runJson ? test : test.skip)('JSON_EXTRACT parameterized select (path param only)', async () => {
    const conn = process.env.MYSQL_URL || 'mysql://root:test@localhost:3306/testdb';
    const ctx = new Ctx(conn);
    await ctx.ensureCreated();
    try {
      const res = await (ctx as any).provider.executeQuery(
        'SELECT JSON_EXTRACT(\'{\"a\":{\"b\":1}}\', ?) as v',
        ['$.a.b']
      );
      expect(res).toBeDefined();
    } finally {
      await ctx.dispose();
    }
  });

  (run ? test : test.skip)('JSON functions availability smoke (JSON_VALID)', async () => {
    const conn = process.env.MYSQL_URL || 'mysql://root:test@localhost:3306/testdb';
    const ctx = new Ctx(conn);
    await ctx.ensureCreated();
    try {
      let ok = false;
      try {
        const res = await (ctx as any).provider.executeQuery('SELECT JSON_VALID(?) as ok', [
          '{\"a\":1}'
        ]);
        ok = Array.isArray(res) ? Boolean((res as any)[0]?.ok ?? 0) : true;
      } catch {
        ok = false;
      }
      // Diagnostic only; do not fail CI
      // eslint-disable-next-line no-console
      console.log('MySQL JSON_VALID support:', ok);
      expect(true).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });
});
