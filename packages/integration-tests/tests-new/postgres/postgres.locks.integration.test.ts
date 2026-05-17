import { PostgresProvider } from '@ts-linq/provider-postgres';
import { DatabaseError } from '@ts-linq/types';

const url = process.env.POSTGRES_URL || '';
const d = url ? describe : describe.skip;

// Helper to run concurrent function
async function inParallel<T>(...fns: Array<() => Promise<T>>): Promise<T[]> {
  return await Promise.all(fns.map((f) => f()));
}

d('[integration][postgres] locks and concurrency', () => {
  test('NOWAIT blocks and throws, SKIP LOCKED works', async () => {
    const p1 = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    const p2 = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    await p1.connect();
    await p2.connect();
    try {
      await p1.executeNonQuery('DROP TABLE IF EXISTS "items_lock"');
      await p1.executeNonQuery(
        'CREATE TABLE "items_lock"(id SERIAL PRIMARY KEY, name TEXT NOT NULL)'
      );
      await p1.executeNonQuery("INSERT INTO \"items_lock\"(name) VALUES('a'),('b'),('c')");

      await p1.beginTransaction();
      const rows = await p1.executeQuery<{ id: number }>(
        'SELECT id FROM "items_lock" ORDER BY id LIMIT 1'
      );
      const lockedId = rows[0].id;
      await p1.executeNonQuery(`SELECT 1 FROM "items_lock" WHERE id = $1 FOR UPDATE`, [lockedId]);

      // NOWAIT should fail
      await expect(
        p2.executeQuery(`SELECT id FROM "items_lock" WHERE id = $1 FOR UPDATE NOWAIT`, [
          lockedId as unknown as never
        ])
      ).rejects.toBeInstanceOf(DatabaseError);

      // SKIP LOCKED should return other rows
      const rest = await p2.executeQuery<{ id: number }>(
        `SELECT id FROM "items_lock" FOR UPDATE SKIP LOCKED`
      );
      expect(rest.some((r) => r.id === lockedId)).toBe(false);

      await p1.commitTransaction();
    } finally {
      try {
        await p1.executeNonQuery('DROP TABLE IF EXISTS "items_lock"');
      } catch {}
      await p1.disconnect().catch(() => {});
      await p2.disconnect().catch(() => {});
    }
  });

  test('deadlock scenario results in DatabaseError for one of transactions', async () => {
    const p1 = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    const p2 = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    await p1.connect();
    await p2.connect();
    try {
      await p1.executeNonQuery('DROP TABLE IF EXISTS "dead_items"');
      await p1.executeNonQuery(
        'CREATE TABLE "dead_items"(id SERIAL PRIMARY KEY, name TEXT NOT NULL)'
      );
      await p1.executeNonQuery("INSERT INTO \"dead_items\"(name) VALUES('x'),('y')");

      const [a, b] = await p1.executeQuery<{ id: number }>(
        'SELECT id FROM "dead_items" ORDER BY id LIMIT 2'
      );

      await p1.beginTransaction();
      await p2.beginTransaction();

      await p1.executeNonQuery('UPDATE "dead_items" SET name = name || ' + "'-1' WHERE id = $1", [
        a.id
      ]);
      await p2.executeNonQuery('UPDATE "dead_items" SET name = name || ' + "'-2' WHERE id = $1", [
        b.id
      ]);

      const t1 = () =>
        p1.executeNonQuery('UPDATE "dead_items" SET name = name || ' + "'-1' WHERE id = $1", [
          b.id
        ]);
      const t2 = () =>
        p2.executeNonQuery('UPDATE "dead_items" SET name = name || ' + "'-2' WHERE id = $1", [
          a.id
        ]);

      // Run concurrently to reliably create a deadlock; Postgres will abort one side.
      const settled = await Promise.allSettled([t1(), t2()]);
      const rejected = settled.filter((r) => r.status === 'rejected').length;
      // At least one should fail (deadlock/cancel)
      expect(rejected).toBeGreaterThanOrEqual(1);

      await p1.rollbackTransaction().catch(() => {});
      await p2.rollbackTransaction().catch(() => {});
    } finally {
      try {
        await p1.executeNonQuery('DROP TABLE IF EXISTS "dead_items"');
      } catch {}
      await p1.disconnect().catch(() => {});
      await p2.disconnect().catch(() => {});
    }
  });
});
