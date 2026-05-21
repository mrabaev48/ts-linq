import { HierarchyId } from '@ts-linq/core';
import { decodeHierarchyId, encodeHierarchyId, MssqlProvider } from '@ts-linq/provider-mssql';

const url = process.env.MSSQL_URL;
const mssqlDescribe = url ? describe : describe.skip;

mssqlDescribe('[integration][mssql] HierarchyId operations', () => {
  let provider: MssqlProvider;

  beforeAll(async () => {
    provider = new MssqlProvider({
      server: process.env.MSSQL_SERVER || 'localhost',
      port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT) : 1433,
      database: process.env.MSSQL_DB || 'test',
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD,
      trustServerCertificate: true
    });
    await provider.connect();
    await provider.executeNonQuery(
      `IF OBJECT_ID('mssql_hierarchy_nodes','U') IS NOT NULL DROP TABLE mssql_hierarchy_nodes`
    );
    await provider.executeNonQuery(`
      CREATE TABLE mssql_hierarchy_nodes (
        id    INT IDENTITY(1,1) PRIMARY KEY,
        label NVARCHAR(255) NOT NULL,
        path  hierarchyid NOT NULL
      )
    `);
  });

  afterAll(async () => {
    try {
      await provider.executeNonQuery(
        `IF OBJECT_ID('mssql_hierarchy_nodes','U') IS NOT NULL DROP TABLE mssql_hierarchy_nodes`
      );
    } catch {}
    await provider.disconnect();
  });

  test('insert hierarchyid rows using hierarchyid::Parse', async () => {
    await provider.executeNonQuery(
      `INSERT INTO mssql_hierarchy_nodes(label, path) VALUES('root', hierarchyid::Parse('/'))`
    );
    await provider.executeNonQuery(
      `INSERT INTO mssql_hierarchy_nodes(label, path) VALUES('child1', hierarchyid::Parse('/1/'))`
    );
    await provider.executeNonQuery(
      `INSERT INTO mssql_hierarchy_nodes(label, path) VALUES('child1_1', hierarchyid::Parse('/1/1/'))`
    );
    const rows = await provider.executeQuery<{ label: string }>(
      `SELECT label FROM mssql_hierarchy_nodes ORDER BY path`
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]?.label).toBe('root');
  });

  test('IsDescendantOf returns correct descendants', async () => {
    const rows = await provider.executeQuery<{ label: string }>(
      `SELECT label FROM mssql_hierarchy_nodes
       WHERE path.IsDescendantOf(hierarchyid::Parse('/1/')) = 1
       ORDER BY path`
    );
    expect(rows.map((r) => r.label)).toEqual(['child1', 'child1_1']);
  });

  test('GetLevel returns correct depth', async () => {
    const rows = await provider.executeQuery<{ label: string; level: number }>(
      `SELECT label, path.GetLevel() AS level FROM mssql_hierarchy_nodes ORDER BY path`
    );
    expect(rows.find((r) => r.label === 'root')?.level).toBe(0);
    expect(rows.find((r) => r.label === 'child1')?.level).toBe(1);
    expect(rows.find((r) => r.label === 'child1_1')?.level).toBe(2);
  });

  test('codec round-trip: encodeHierarchyId / decodeHierarchyId', () => {
    const h = HierarchyId.parse('/1/2/3/');
    const encoded = encodeHierarchyId(h);
    const decoded = decodeHierarchyId(encoded);
    expect(decoded.toString()).toBe('/1/2/3/');
    expect(decoded.getLevel()).toBe(3);
  });

  test('isDescendantOf logic matches DB result', async () => {
    const parent = HierarchyId.parse('/1/');
    const child = HierarchyId.parse('/1/1/');
    expect(child.isDescendantOf(parent)).toBe(true);

    const rows = await provider.executeQuery<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM mssql_hierarchy_nodes
       WHERE path.IsDescendantOf(hierarchyid::Parse('${encodeHierarchyId(parent)}')) = 1`
    );
    expect(Number(rows[0]?.cnt)).toBe(2);
  });
});
