import { Column, createPoint, Entity, isPoint, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';
import { geometryToEwkbHex } from '@ts-linq/provider-postgres';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

// ─── Entity ───────────────────────────────────────────────────────────────────

@Entity({ name: 'spatial_cities' })
class City {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;
}

class TestDbContext extends DbContext {}

// ─── Suite ────────────────────────────────────────────────────────────────────

const run = process.env.SKIP_DB_TESTS !== '1';

// Spatial e2e currently targets PostgreSQL only (PostGIS required).
// MySQL / MSSQL spatial integration is covered in packages/integration-tests.
(run ? describe : describe.skip)('E2E Spatial (PostgreSQL / PostGIS)', () => {
  let harness: any;
  let provider: any;
  let context: TestDbContext;

  beforeAll(async () => {
    ({ harness, provider } = await setupTestDatabase('postgresql'));
    context = new TestDbContext({ provider });

    // PostGIS extension + table with geometry column (created via raw SQL)
    try {
      await provider.executeNonQuery('CREATE EXTENSION IF NOT EXISTS postgis');
    } catch {
      // PostGIS may not be available in all CI environments — skip gracefully
    }
    await provider.executeNonQuery('DROP TABLE IF EXISTS "spatial_cities"');
    await provider.executeNonQuery(`
      CREATE TABLE "spatial_cities" (
        id       SERIAL PRIMARY KEY,
        name     TEXT NOT NULL,
        location GEOMETRY(Point, 4326)
      )
    `);
  });

  afterAll(async () => {
    await dropTables(provider, ['spatial_cities']);
    await context.dispose();
    await teardownTestDatabase(harness);
  });

  test('insert Point via WKB hex and retrieve via raw SQL', async () => {
    const berlin = createPoint(13.404954, 52.520008);
    const hex = geometryToEwkbHex(berlin);
    await provider.executeNonQuery(
      `INSERT INTO "spatial_cities"(name, location) VALUES($1, $2::geometry)`,
      ['Berlin', `\\x${hex}`]
    );
    const rows = (await provider.executeQuery(`SELECT name FROM "spatial_cities" WHERE name = $1`, [
      'Berlin'
    ])) as Array<{ name: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Berlin');
  });

  test('ST_Distance returns a positive value between two points', async () => {
    const paris = createPoint(2.349014, 48.864716);
    const parisHex = geometryToEwkbHex(paris);
    await provider.executeNonQuery(
      `INSERT INTO "spatial_cities"(name, location) VALUES($1, $2::geometry)`,
      ['Paris', `\\x${parisHex}`]
    );
    const berlinHex = geometryToEwkbHex(createPoint(13.404954, 52.520008));
    const rows = (await provider.executeQuery(
      `SELECT ST_Distance(
         location::geography,
         ST_GeomFromEWKB($1)::geography
       ) AS dist
       FROM "spatial_cities"
       WHERE name = $2`,
      [`\\x${berlinHex}`, 'Paris']
    )) as Array<{ dist: string }>;
    const dist = parseFloat(rows[0]?.dist ?? '0');
    expect(dist).toBeGreaterThan(100_000); // > 100 km (Berlin–Paris ≈ 878 km)
  });

  test('isPoint type guard works on createPoint result', () => {
    const pt = createPoint(1.0, 2.0);
    expect(isPoint(pt)).toBe(true);
    expect(pt.x).toBeCloseTo(1.0, 6);
    expect(pt.y).toBeCloseTo(2.0, 6);
    expect(pt.srid).toBe(4326);
  });
});
