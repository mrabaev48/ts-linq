import { createLineString, createPoint, createPolygon } from '@ts-linq/core';
import { PostgresProvider } from '@ts-linq/provider-postgres';
import { decodeWkb, encodeWkb, geometryToEwkbHex } from '@ts-linq/provider-postgres';

const url = process.env.POSTGRES_URL || '';
const pgDescribe = url ? describe : describe.skip;

pgDescribe('[integration][postgres] Spatial / PostGIS operations', () => {
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
    // PostGIS extension must be available
    await p.executeNonQuery('CREATE EXTENSION IF NOT EXISTS postgis');
    await p.executeNonQuery('DROP TABLE IF EXISTS "pg_spatial_cities"');
    await p.executeNonQuery(`
      CREATE TABLE "pg_spatial_cities" (
        id     SERIAL PRIMARY KEY,
        name   TEXT NOT NULL,
        location GEOMETRY(Point, 4326)
      )
    `);
  });

  afterAll(async () => {
    try {
      await p.executeNonQuery('DROP TABLE IF EXISTS "pg_spatial_cities"');
    } catch {}
    await p.disconnect();
  });

  test('insert Point via WKB hex and read back', async () => {
    const berlin = createPoint(13.404954, 52.520008);
    const hex = geometryToEwkbHex(berlin);
    await p.executeNonQuery(
      `INSERT INTO "pg_spatial_cities"(name, location) VALUES($1, $2::geometry)`,
      ['Berlin', `\\x${hex}`]
    );
    const rows = await p.executeQuery<{ name: string }>(
      'SELECT name FROM "pg_spatial_cities" WHERE name = $1',
      ['Berlin']
    );
    expect(rows[0]?.name).toBe('Berlin');
  });

  test('ST_Distance returns numeric value', async () => {
    const paris = createPoint(2.349014, 48.864716);
    const hex = geometryToEwkbHex(paris);
    await p.executeNonQuery(
      `INSERT INTO "pg_spatial_cities"(name, location) VALUES($1, $2::geometry)`,
      ['Paris', `\\x${hex}`]
    );
    const rows = await p.executeQuery<{ dist: string }>(
      `SELECT ST_Distance(
         location::geography,
         ST_GeomFromEWKB($1)::geography
       ) AS dist
       FROM "pg_spatial_cities"
       WHERE name = $2`,
      [`\\x${hex}`, 'Berlin']
    );
    // Paris-Berlin distance is ~878 km → expect > 0
    const dist = parseFloat(rows[0]?.dist ?? '0');
    expect(dist).toBeGreaterThan(0);
  });

  test('WKB round-trip via encodeWkb / decodeWkb (no DB)', () => {
    const pt = createPoint(13.404954, 52.520008);
    const buf = encodeWkb(pt);
    const decoded = decodeWkb(buf);
    expect(decoded.type).toBe('Point');
    const dpt = decoded as typeof pt;
    expect(dpt.x).toBeCloseTo(13.404954, 5);
    expect(dpt.y).toBeCloseTo(52.520008, 5);
    expect(dpt.srid).toBe(4326);
  });

  test('LineString WKB round-trip', () => {
    const ls = createLineString([createPoint(0, 0), createPoint(1, 1), createPoint(2, 0)]);
    const decoded = decodeWkb(encodeWkb(ls)) as typeof ls;
    expect(decoded.type).toBe('LineString');
    expect(decoded.coordinates).toHaveLength(3);
    expect(decoded.coordinates[1]!.x).toBeCloseTo(1, 5);
  });

  test('Polygon WKB round-trip', () => {
    const ring = createLineString([
      createPoint(0, 0),
      createPoint(4, 0),
      createPoint(4, 4),
      createPoint(0, 4),
      createPoint(0, 0)
    ]);
    const poly = createPolygon(ring);
    const decoded = decodeWkb(encodeWkb(poly)) as typeof poly;
    expect(decoded.type).toBe('Polygon');
    expect(decoded.exterior.coordinates).toHaveLength(5);
  });
});
