import { createLineString, createPoint, createPolygon } from '@ts-linq/core';
import { decodeWkt, encodeWkt, MssqlProvider } from '@ts-linq/provider-mssql';

const url = process.env.MSSQL_URL;
const mssqlDescribe = url ? describe : describe.skip;

mssqlDescribe('[integration][mssql] Spatial operations', () => {
  let provider: MssqlProvider;

  beforeAll(async () => {
    provider = new MssqlProvider({
      server: process.env.MSSQL_SERVER || 'localhost',
      port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT) : 1433,
      database: process.env.MSSQL_DB || 'test',
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD
    });
    await provider.connect();
    await provider.executeNonQuery(
      `IF OBJECT_ID('mssql_spatial_cities','U') IS NOT NULL DROP TABLE mssql_spatial_cities`
    );
    await provider.executeNonQuery(`
      CREATE TABLE mssql_spatial_cities (
        id       INT IDENTITY(1,1) PRIMARY KEY,
        name     NVARCHAR(255) NOT NULL,
        location GEOGRAPHY
      )
    `);
  });

  afterAll(async () => {
    try {
      await provider.executeNonQuery(
        `IF OBJECT_ID('mssql_spatial_cities','U') IS NOT NULL DROP TABLE mssql_spatial_cities`
      );
    } catch {}
    await provider.disconnect();
  });

  test('insert Point via WKT and STDistance returns a positive value', async () => {
    const berlin = createPoint(13.404954, 52.520008);
    const paris = createPoint(2.349014, 48.864716);
    const berlinWkt = encodeWkt(berlin);
    const parisWkt = encodeWkt(paris);
    await provider.executeNonQuery(
      `INSERT INTO mssql_spatial_cities(name, location)
       VALUES('Berlin', geography::STGeomFromText('${berlinWkt}', 4326))`
    );
    const rows = await provider.executeQuery<{ dist: number }>(
      `SELECT TOP 1 location.STDistance(geography::STGeomFromText('${parisWkt}', 4326)) AS dist
       FROM mssql_spatial_cities
       WHERE name = 'Berlin'`
    );
    const dist = rows[0]?.dist ?? 0;
    expect(dist).toBeGreaterThan(0);
  });

  test('WKT round-trip for Point (no DB)', () => {
    const pt = createPoint(13.404954, 52.520008);
    const wkt = encodeWkt(pt);
    expect(wkt).toContain('POINT');
    const decoded = decodeWkt(wkt) as typeof pt;
    expect(decoded.type).toBe('Point');
    expect(decoded.x).toBeCloseTo(13.404954, 5);
    expect(decoded.y).toBeCloseTo(52.520008, 5);
  });

  test('WKT round-trip for LineString (no DB)', () => {
    const ls = createLineString([createPoint(0, 0), createPoint(1, 1)]);
    const decoded = decodeWkt(encodeWkt(ls)) as typeof ls;
    expect(decoded.type).toBe('LineString');
    expect(decoded.coordinates).toHaveLength(2);
  });

  test('WKT round-trip for Polygon (no DB)', () => {
    const ring = createLineString([
      createPoint(0, 0),
      createPoint(4, 0),
      createPoint(4, 4),
      createPoint(0, 4),
      createPoint(0, 0)
    ]);
    const poly = createPolygon(ring);
    const decoded = decodeWkt(encodeWkt(poly)) as typeof poly;
    expect(decoded.type).toBe('Polygon');
    expect(decoded.exterior.coordinates).toHaveLength(5);
  });
});
