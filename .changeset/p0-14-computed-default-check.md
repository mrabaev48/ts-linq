---
'@ts-linq/orm': minor
'@ts-linq/metadata': minor
'@ts-linq/migrations': minor
'@ts-linq/types': minor
'@ts-linq/dialect-postgres': minor
'@ts-linq/dialect-mysql': minor
'@ts-linq/dialect-mssql': minor
---

feat(P0-14): add HasComputedColumnSql, HasCheckConstraint, HasComment fluent API

- PropertyBuilder: hasComputedColumnSql(sql, options?) sets isComputed/computedExpression/computedStorage
- PropertyBuilder: hasComment(comment) stores column-level documentation
- EntityTypeBuilder: hasCheckConstraint(name, sql) declares CHECK constraints
- EntityTypeBuilder: hasComment(comment) stores table-level documentation
- CheckConstraintMetadata interface added to @ts-linq/types
- ColumnMetadata extended with comment and computedStorage fields
- EntityMetadata extended with checkConstraints and comment fields
- SchemaSnapshot applies value converter to defaultValue during ColumnDef construction
- All three dialects emit CHECK constraints inline in CREATE TABLE
- PostgresDdlStrategy/MssqlDdlStrategy: generateCommentSql() emits COMMENT ON / sp_addextendedproperty
- MySQL: column comments emitted inline, table comments in CREATE TABLE options
