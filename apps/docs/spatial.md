# Spatial Types — ts-linq

ts-linq supports geospatial column types via the `@ts-linq/core` geometry primitives and per-dialect WKB/WKT codecs.

## Supported dialects

| Dialect     | Extension / feature        | Input format | Functions prefix    |
|-------------|---------------------------|--------------|---------------------|
| PostgreSQL  | PostGIS (`postgis`)        | EWKB hex     | `ST_*`              |
| MySQL       | MySQL Spatial              | ISO WKB      | `ST_*`              |
| SQL Server  | `geography` / `geometry`   | WKT          | `.ST*()` method syntax |

---

## Geometry primitives (`@ts-linq/core`)

```ts
import {
  createPoint, createLineString, createPolygon,
  isPoint, isLineString, isPolygon,
} from '@ts-linq/core';

const berlin   = createPoint(13.404954, 52.520008);        // srid defaults to 4326
const route    = createLineString([berlin, createPoint(2.349014, 48.864716)]);
const district = createPolygon(
  createLineString([
    createPoint(0, 0), createPoint(4, 0), createPoint(4, 4),
    createPoint(0, 4), createPoint(0, 0),
  ])
);
```

All geometry objects implement the `Geometry` interface from `@ts-linq/core`:

```ts
interface Geometry { readonly type: GeometryType; readonly srid?: number; }
```

---

## Column mapping

Use `@Column({ type: 'geography(Point,4326)' })` (or `hasColumnType()` in the fluent API) to tell the schema generator what SQL column type to create:

```ts
import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import type { Point } from '@ts-linq/core';

@Entity({ name: 'cities' })
class City {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'geography(Point,4326)' })   // PostGIS
  // @Column({ type: 'POINT' })               // MySQL
  // @Column({ type: 'geography' })           // MSSQL
  location!: Point;
}
```

> **Note:** The ORM write path automatically encodes `Geometry` values to the correct wire format (EWKB for PostgreSQL, ISO WKB for MySQL, WKT for MSSQL) via `coerceToSqlParameter`.

---

## Per-dialect setup

### PostgreSQL (PostGIS)

```ts
import { DbContext } from '@ts-linq/orm';
import { PostgresProvider } from '@ts-linq/provider-postgres';
import { postgisSpatialFunctions } from '@ts-linq/dialect-postgres';

const provider = new PostgresProvider({ /* ... */ });
// Pass spatial translator to SqlVisitor when building queries manually:
import { SqlVisitor, ParameterStyle } from '@ts-linq/sql-visitor';
const visitor = new SqlVisitor(ParameterStyle.Dollar, {
  spatialTranslator: postgisSpatialFunctions,
});
```

Make sure the PostGIS extension is installed in the target database:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### MySQL

```ts
import { mysqlSpatialFunctions } from '@ts-linq/dialect-mysql';
import { SqlVisitor, ParameterStyle } from '@ts-linq/sql-visitor';

const visitor = new SqlVisitor(ParameterStyle.Question, {
  spatialTranslator: mysqlSpatialFunctions,
});
```

### SQL Server

```ts
import { mssqlSpatialFunctions } from '@ts-linq/dialect-mssql';
import { SqlVisitor, ParameterStyle } from '@ts-linq/sql-visitor';

const visitor = new SqlVisitor(ParameterStyle.Named, {
  spatialTranslator: mssqlSpatialFunctions,
});
```

---

## WKB / WKT codec usage

Each provider package exports a codec for direct use:

### PostgreSQL (EWKB)

```ts
import { encodeWkb, decodeWkb, geometryToEwkbHex } from '@ts-linq/provider-postgres';

const buf = encodeWkb(berlin);          // Buffer
const hex = geometryToEwkbHex(berlin);  // hex string (without \x prefix)
const decoded = decodeWkb(buf);         // Geometry
const fromHex = decodeWkb(hex);         // also accepts hex string or \x-prefixed hex
```

### MySQL (ISO WKB)

```ts
import { encodeWkb, decodeWkb } from '@ts-linq/provider-mysql';

const buf     = encodeWkb(berlin);
const decoded = decodeWkb(buf);         // handles optional MySQL 4-byte SRID prefix
```

### SQL Server (WKT)

```ts
import { encodeWkt, decodeWkt, decodeWkb } from '@ts-linq/provider-mssql';

const wkt     = encodeWkt(berlin);        // 'POINT (13.404954 52.520008)'
const decoded = decodeWkt(wkt);           // Geometry
const fromBin = decodeWkb(binaryBuf);     // for binary column output
```

---

## Raw SQL spatial queries

Since the WHERE lambda transformer extension for spatial methods is pending (see _Known limitations_ below), use `executeQuery` / `executeNonQuery` for spatial predicates:

```ts
// PostgreSQL
const nearby = await provider.executeQuery<{ name: string; dist: number }>(
  `SELECT name, ST_Distance(location::geography, ST_GeomFromEWKB($1)::geography) AS dist
   FROM cities
   WHERE ST_Distance(location::geography, ST_GeomFromEWKB($1)::geography) < $2`,
  [`\\x${geometryToEwkbHex(origin)}`, radiusMeters]
);

// MySQL
const nearby = await provider.executeQuery(
  `SELECT name FROM cities WHERE ST_Distance_Sphere(location, ST_GeomFromWKB(?, 4326)) < ?`,
  [encodeWkb(origin), radiusMeters]
);

// SQL Server
const wkt = encodeWkt(origin);
const nearby = await provider.executeQuery(
  `SELECT name FROM cities WHERE location.STDistance(geography::STGeomFromText('${wkt}', 4326)) < @dist`,
  [radiusMeters]
);
```

---

## `useSpatial()` on DbContextOptionsBuilder

```ts
import { DbContextOptionsBuilder } from '@ts-linq/orm';

const options = new DbContextOptionsBuilder()
  .useProvider(provider)
  .useSpatial()           // marks spatialEnabled: true in options
  .build();
```

`spatialEnabled` is available on `DbContextOptions` for provider-level configuration hooks.

---

## Supported geometry types

| Type                | Factory                                     |
|---------------------|---------------------------------------------|
| `Point`             | `createPoint(x, y, srid?)`                  |
| `LineString`        | `createLineString(points, srid?)`            |
| `Polygon`           | `createPolygon(exterior, holes?, srid?)`     |
| `MultiPoint`        | `createMultiPoint(points, srid?)`            |
| `MultiLineString`   | `createMultiLineString(lineStrings, srid?)`  |
| `MultiPolygon`      | `createMultiPolygon(polygons, srid?)`        |
| `GeometryCollection`| `createGeometryCollection(geometries, srid?)`|

---

## Known limitations

- **WHERE lambda syntax** (`c => c.location.distance(origin).lt(10000)`) requires extension of the TypeScript AST transformer (`@ts-linq/transformer`) and is planned for a future release (P2-34 follow-up).
- `Multi*` and `GeometryCollection` round-trip through WKB/WKT is supported at codec level but not tested with live DB containers.
- SQL Server `geography` vs. `geometry` distinction: both map to WKT input; use the appropriate SQL function (`geography::STGeomFromText` vs `geometry::STGeomFromText`) in raw queries.
