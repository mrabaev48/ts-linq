import { createLineString, createPoint, createPolygon } from '@ts-linq/core';
import { MySqlProvider } from '@ts-linq/provider-mysql';
import { decodeWkb, encodeWkb } from '@ts-linq/provider-mysql';

const run = !!process.env.RUN_DB_TESTS;
const runSpatial = process.env.MYSQL_SPATIAL === '1';

(run ? describe : describe.skip)('[integration][mysql] Spatial operations', () => {
  let provider: MySqlProvider;

  beforeAll(async () => {
    provider = new MySqlProvider({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
      database: process.env.MYSQL_DB || 'test',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD
    });
    await provider.connect();
    await provider.executeNonQuery('DROP TABLE IF EXISTS `mysql_spatial_cities`');
    await provider.executeNonQuery(`
      CREATE TABLE \`mysql_spatial_cities\` (
        id       INT AUTO_INCREMENT PRIMARY KEY,
        name     VARCHAR(255) NOT NULL,
        location POINT NOT NULL SRID 4326
      )
    `);
  });

  afterAll(async () => {
    try {
      await provider.executeNonQuery('DROP TABLE IF EXISTS `mysql_spatial_cities`');
    } catch {}
    await provider.disconnect();
  });

  (runSpatial ? test : test.skip)('insert Point and run ST_Distance_Sphere', async () => {
    const berlin = createPoint(13.404954, 52.520008);
    const wkb = encodeWkb(berlin);
    await provider.executeNonQuery(
      'INSERT INTO `mysql_spatial_cities`(name, location) VALUES(?, ST_GeomFromWKB(?, 4326))',
      ['Berlin', wkb]
    );
    const paris = createPoint(2.349014, 48.864716);
    const parisWkb = encodeWkb(paris);
    const rows = await provider.executeQuery<{ dist: number }>(
      'SELECT ST_Distance_Sphere(location, ST_GeomFromWKB(?, 4326)) AS dist FROM `mysql_spatial_cities` WHERE name = ?',
      [parisWkb, 'Berlin']
    );
    const dist = rows[0]?.dist ?? 0;
    expect(dist).toBeGreaterThan(0);
  });

  test('WKB round-trip for Point (no DB)', () => {
    const pt = createPoint(13.404954, 52.520008);
    const buf = encodeWkb(pt);
    const decoded = decodeWkb(buf) as typeof pt;
    expect(decoded.type).toBe('Point');
    expect(decoded.x).toBeCloseTo(13.404954, 5);
    expect(decoded.y).toBeCloseTo(52.520008, 5);
  });

  test('WKB round-trip for LineString (no DB)', () => {
    const ls = createLineString([createPoint(0, 0), createPoint(1, 1)]);
    const decoded = decodeWkb(encodeWkb(ls)) as typeof ls;
    expect(decoded.type).toBe('LineString');
    expect(decoded.coordinates).toHaveLength(2);
  });

  test('WKB round-trip for Polygon (no DB)', () => {
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
