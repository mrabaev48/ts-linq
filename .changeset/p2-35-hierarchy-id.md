---
'@ts-linq/ast': minor
'@ts-linq/core': minor
'@ts-linq/dialect-mssql': minor
'@ts-linq/dialect-postgres': minor
'@ts-linq/provider-mssql': minor
'@ts-linq/provider-postgres': minor
'@ts-linq/sql-visitor': minor
'@ts-linq/types': minor
---

feat(P2-35): add HierarchyId support — SQL Server hierarchyid with PostgreSQL ltree fallback

Mirrors EF Core 8's `HierarchyId` API:
- `HierarchyId` class in `@ts-linq/core` with `getLevel`, `getAncestor`, `isDescendantOf`, `getDescendant`, `toString`, `toLtreeString`
- `HierarchyIdTranslator` interface in `@ts-linq/types`
- `HierarchyMethod` union type (`isDescendantOf | getLevel | getAncestor`) in `@ts-linq/ast`
- `HierarchyMethodVisitor` in `@ts-linq/sql-visitor` — dispatches to dialect-specific SQL
- `mssqlHierarchyFunctions` in `@ts-linq/dialect-mssql` — uses `hierarchyid::Parse(?)`, `.GetLevel()`, `.GetAncestor(?)`
- `postgresLtreeFunctions` in `@ts-linq/dialect-postgres` — uses `<@`, `nlevel()`, `subpath()`
- MSSQL codec (`encodeHierarchyId` / `decodeHierarchyId`) in `@ts-linq/provider-mssql`
- Postgres ltree codec (`encodeLtree` / `decodeLtree`) in `@ts-linq/provider-postgres`
- Both providers detect `HierarchyId` in `coerceToSqlParameter` before geometry/JSON fallback
