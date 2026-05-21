import { HierarchyId } from '@ts-linq/core';
import { decodeLtree, encodeLtree, PostgresProvider } from '@ts-linq/provider-postgres';

const url = process.env.POSTGRES_URL || '';
const pgDescribe = url ? describe : describe.skip;

pgDescribe('[integration][postgres] HierarchyId / ltree operations', () => {
  let p: PostgresProvider;

  beforeAll(async () => {
    p = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    await p.connect();
    await p.executeNonQuery('CREATE EXTENSION IF NOT EXISTS ltree');
    await p.executeNonQuery('DROP TABLE IF EXISTS "pg_hierarchy_nodes"');
    await p.executeNonQuery(`
      CREATE TABLE "pg_hierarchy_nodes" (
        id    SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        path  ltree NOT NULL
      )
    `);
  });

  afterAll(async () => {
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "pg_hierarchy_nodes"');
    } catch {}
    await p.disconnect();
  });

  test('insert ltree rows', async () => {
    await p.executeNonQuery(`INSERT INTO "pg_hierarchy_nodes"(label, path) VALUES($1, $2::ltree)`, [
      'child1',
      '1'
    ]);
    await p.executeNonQuery(`INSERT INTO "pg_hierarchy_nodes"(label, path) VALUES($1, $2::ltree)`, [
      'child1_1',
      '1.1'
    ]);
    await p.executeNonQuery(`INSERT INTO "pg_hierarchy_nodes"(label, path) VALUES($1, $2::ltree)`, [
      'child2',
      '2'
    ]);
    const rows = await p.executeQuery<{ label: string }>(`SELECT label FROM "pg_hierarchy_nodes"`);
    expect(rows).toHaveLength(3);
  });

  test('<@ operator finds descendants', async () => {
    const rows = await p.executeQuery<{ label: string }>(
      `SELECT label FROM "pg_hierarchy_nodes" WHERE path <@ $1::ltree ORDER BY path`,
      ['1']
    );
    expect(rows.map((r) => r.label)).toEqual(['child1', 'child1_1']);
  });

  test('nlevel() returns correct depth', async () => {
    const rows = await p.executeQuery<{ label: string; level: number }>(
      `SELECT label, nlevel(path) AS level FROM "pg_hierarchy_nodes" ORDER BY path`
    );
    expect(rows.find((r) => r.label === 'child1')?.level).toBe(1);
    expect(rows.find((r) => r.label === 'child1_1')?.level).toBe(2);
  });

  test('codec round-trip: encodeLtree / decodeLtree', () => {
    const h = HierarchyId.parse('/1/2/3/');
    const encoded = encodeLtree(h);
    expect(encoded).toBe('1.2.3');
    const decoded = decodeLtree(encoded);
    expect(decoded.toString()).toBe('/1/2/3/');
  });

  test('encodeLtree result matches DB query', async () => {
    const h = HierarchyId.parse('/1/');
    const ltreeStr = encodeLtree(h);
    const rows = await p.executeQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM "pg_hierarchy_nodes" WHERE path <@ $1::ltree`,
      [ltreeStr]
    );
    expect(Number(rows[0]?.cnt)).toBe(2);
  });
});
