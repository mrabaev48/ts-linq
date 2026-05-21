---
"@ts-linq/core": minor
"@ts-linq/ast": minor
"@ts-linq/types": minor
"@ts-linq/sql-visitor": minor
"@ts-linq/dialect-postgres": minor
"@ts-linq/dialect-mysql": minor
"@ts-linq/dialect-mssql": minor
"@ts-linq/provider-postgres": minor
"@ts-linq/provider-mysql": minor
"@ts-linq/provider-mssql": minor
"@ts-linq/orm": minor
---

Add spatial / geospatial types support (P2-34)

Implements a NetTopologySuite-equivalent spatial type system:

- **`@ts-linq/core`** — `Geometry`, `Point`, `LineString`, `Polygon`, `MultiPoint`, `MultiLineString`, `MultiPolygon`, `GeometryCollection` interfaces with factory functions and type guards
- **`@ts-linq/ast`** — `SpatialMethod` union type; `MethodNode.method` extended to include spatial method names
- **`@ts-linq/types`** — `SpatialTranslator` interface for dialect-specific spatial SQL generation
- **`@ts-linq/sql-visitor`** — `SpatialMethodVisitor`, `isSpatialMethod` helper; `SqlVisitor` accepts `{ spatialTranslator }` option
- **`@ts-linq/dialect-postgres`** — `postgisSpatialFunctions` (PostGIS `ST_*` functions)
- **`@ts-linq/dialect-mysql`** — `mysqlSpatialFunctions` (MySQL `ST_*` + `ST_Distance_Sphere`)
- **`@ts-linq/dialect-mssql`** — `mssqlSpatialFunctions` (method-syntax `.STDistance()` etc.)
- **`@ts-linq/provider-postgres`** — EWKB encode/decode codec; `Geometry` auto-coercion in `coerceToSqlParameter`
- **`@ts-linq/provider-mysql`** — ISO WKB encode/decode codec; `Geometry` auto-coercion
- **`@ts-linq/provider-mssql`** — WKT encode/decode codec; `Geometry` auto-coercion
- **`@ts-linq/orm`** — `DbContextOptionsBuilder.useSpatial()` method
