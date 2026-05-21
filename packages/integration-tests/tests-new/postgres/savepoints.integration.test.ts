import { PostgresProvider } from '@ts-linq/provider-postgres';

const PG = process.env.POSTGRES_URL || '';
const d = PG ? describe : describe.skip;

d('[integration][postgres] transaction savepoints', () => {
  let p: PostgresProvider;

  beforeEach(async () => {
    p = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    await p.connect();
    await p.executeNonQuery(
      'CREATE TABLE IF NOT EXISTS "sp_items"(id SERIAL PRIMARY KEY, name TEXT NOT NULL)'
    );
  });

  afterEach(async () => {
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "sp_items"');
    } catch {}
    await p.disconnect();
  });

  test('createSavepoint / releaseSavepoint within a transaction', async () => {
    await p.beginTransaction();
    await p.executeNonQuery(`INSERT INTO "sp_items"(name) VALUES('row1')`);
    await p.createSavepoint('sp1');
    await p.executeNonQuery(`INSERT INTO "sp_items"(name) VALUES('row2')`);
    await p.releaseSavepoint('sp1');
    await p.commitTransaction();

    const rows = await p.executeQuery<{ name: string }>(`SELECT name FROM "sp_items" ORDER BY id`);
    expect(rows.map((r) => r.name)).toEqual(['row1', 'row2']);
  });

  test('rollbackToSavepoint reverts partial work within a transaction', async () => {
    await p.beginTransaction();
    await p.executeNonQuery(`INSERT INTO "sp_items"(name) VALUES('base')`);
    await p.createSavepoint('before_risky');

    // Risky work — will be rolled back
    await p.executeNonQuery(`INSERT INTO "sp_items"(name) VALUES('risky')`);
    const beforeRollback = await p.executeQuery<{ name: string }>(
      `SELECT name FROM "sp_items" ORDER BY id`
    );
    expect(beforeRollback.map((r) => r.name)).toEqual(['base', 'risky']);

    await p.rollbackToSavepoint('before_risky');

    // Only base row should remain after rollback to savepoint
    const afterRollback = await p.executeQuery<{ name: string }>(
      `SELECT name FROM "sp_items" ORDER BY id`
    );
    expect(afterRollback.map((r) => r.name)).toEqual(['base']);

    await p.commitTransaction();

    const final = await p.executeQuery<{ name: string }>(`SELECT name FROM "sp_items"`);
    expect(final.map((r) => r.name)).toEqual(['base']);
  });

  test('nested savepoints: inner savepoint rolled back, outer committed', async () => {
    await p.beginTransaction();
    await p.executeNonQuery(`INSERT INTO "sp_items"(name) VALUES('outer')`);
    await p.createSavepoint('outer_sp');

    await p.executeNonQuery(`INSERT INTO "sp_items"(name) VALUES('inner')`);
    await p.createSavepoint('inner_sp');

    await p.executeNonQuery(`INSERT INTO "sp_items"(name) VALUES('innermost')`);

    // Rollback to inner savepoint — removes 'innermost'
    await p.rollbackToSavepoint('inner_sp');
    await p.releaseSavepoint('inner_sp');

    // Still have 'inner' row
    const mid = await p.executeQuery<{ name: string }>(`SELECT name FROM "sp_items" ORDER BY id`);
    expect(mid.map((r) => r.name)).toEqual(['outer', 'inner']);

    await p.releaseSavepoint('outer_sp');
    await p.commitTransaction();

    const final = await p.executeQuery<{ name: string }>(`SELECT name FROM "sp_items" ORDER BY id`);
    expect(final.map((r) => r.name)).toEqual(['outer', 'inner']);
  });
});
