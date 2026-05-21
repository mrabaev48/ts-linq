# P2-34 — Spatial Types (NetTopologySuite Equivalent)

**Status:** done (PR #97, branch feat/p2-34-spatial-types)

## Architecture

### Geometry type hierarchy (`@ts-linq/core`)
- `packages/core/src/spatial/` — Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection
- All implement `Geometry` base interface: `{ type: GeometryType; srid?: number }`
- Factory functions: `createPoint(x, y, srid?)`, `createLineString(pts, srid?)`, `createPolygon(ext, holes?, srid?)`, etc.
- Type guards: `isPoint`, `isLineString`, `isPolygon`, `isGeometry`
- Re-exported from `packages/core/src/index.ts` via `export * from './spatial'`

### SpatialTranslator location (`@ts-linq/types`)
- `SpatialTranslator` interface lives in `packages/types/src/index.ts`
- **Reason:** dialect packages (`@ts-linq/dialect-*`) depend on `@ts-linq/types` but NOT on `@ts-linq/sql-visitor`; putting SpatialTranslator in sql-visitor would create a circular dep
- **Do not move to sql-visitor** — this is intentional

### SpatialMethodVisitor (`@ts-linq/sql-visitor`)
- `packages/sql-visitor/src/visitors/SpatialMethodVisitor.ts`
- `isSpatialMethod(method: string): boolean` — guards a `Set` of spatial method names
- `SpatialMethodVisitor.visit(node, inputParams, resolver?, state?)` dispatches:
  - Unary (`area`, `length`) — no parameters
  - Binary (`distance`, `intersects`, `within`, `buffer`, `contains`) — one geometry arg
- `SqlVisitor` accepts `options?: { spatialTranslator?: SpatialTranslator }`; if present, creates `SpatialMethodVisitor` and wires it into `MethodVisitor`

### Dialect functions
- `packages/dialect-postgres/src/spatial-functions.ts` → `postgisSpatialFunctions` (ST_* with ::geography cast)
- `packages/dialect-mysql/src/spatial-functions.ts` → `mysqlSpatialFunctions` (ST_Distance_Sphere, ST_*)
- `packages/dialect-mssql/src/spatial-functions.ts` → `mssqlSpatialFunctions` (method syntax .STDistance() etc.)

### WKB/WKT codecs
- `packages/provider-postgres/src/spatial-codec.ts` — EWKB (with SRID flag 0x20000000), `encodeWkb`, `decodeWkb`, `geometryToEwkbHex`, `isGeometryObject`
- `packages/provider-mysql/src/spatial-codec.ts` — ISO WKB (no SRID prefix on input; strips 4-byte MySQL SRID prefix on decode), `encodeWkb`, `decodeWkb`, `isGeometryObject`
- `packages/provider-mssql/src/spatial-codec.ts` — WKT (MSSQL uses text input for geography), `encodeWkt`, `decodeWkt`, `decodeWkb`, `isGeometryObject`

### Provider coercion
Each provider's `coerceToSqlParameter` detects `isGeometryObject(value)` **before** the JSON/string fallback:
- PostgreSQL → `\\x<ewkb-hex>`
- MySQL → raw `Buffer` (ISO WKB)
- MSSQL → WKT string

### useSpatial()
- `packages/orm/src/DbContextOptionsBuilder.ts` — `useSpatial(): this` sets `_spatialEnabled = true`
- `DbContextOptions` (in `@ts-linq/core/src/types/index.ts`) has `spatialEnabled?: boolean`

### AST extension
- `packages/ast/src/ast/Nodes.ts` — `SpatialMethod = 'distance'|'intersects'|'within'|'buffer'|'area'|'length'|'contains'`
- `MethodNode.method: StringMethod | SpatialMethod`

## Known limitations / follow-up
- WHERE lambda syntax (`c => c.location.distance(origin).lt(10000)`) requires `@ts-linq/transformer` extension — deferred to a separate PR
- Multi* / GeometryCollection WKB codec exists but not tested with live DB containers

## Tests
- Unit: `packages/core/src/spatial/__tests__/geometry.test.ts`, `provider-*/tests-new/spatial-codec.test.ts`, `sql-visitor/tests/SpatialVisitor.test.ts`
- Integration (gated by env vars): `integration-tests/tests-new/postgres|mysql|mssql/spatial.integration.test.ts`
- E2E (gated by SKIP_DB_TESTS): `e2e-tests/tests/queries/spatial.e2e.test.ts`
