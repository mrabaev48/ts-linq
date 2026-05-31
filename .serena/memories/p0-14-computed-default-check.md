# P0-14: HasComputedColumnSql / HasCheckConstraint / HasComment

**Status**: completed
**Branch**: feat/p0-14-computed-default-check
**Packages**: @ts-linq/types, @ts-linq/metadata, @ts-linq/migrations, @ts-linq/orm, @ts-linq/dialect-postgres, @ts-linq/dialect-mysql, @ts-linq/dialect-mssql

## New Public API

### PropertyBuilder (packages/orm/src/builders/PropertyBuilder.ts)
- `hasComputedColumnSql(sql, options?: { stored?: boolean })` — sets isComputed, computedExpression, computedStorage ('STORED'/'VIRTUAL')
- `hasComment(comment)` — sets column.comment

### EntityTypeBuilder (packages/orm/src/builders/EntityTypeBuilder.ts)
- `hasCheckConstraint(name, sql)` — accumulates CheckConstraintMetadata[]
- `hasComment(comment)` — sets entityComment

## New Types (packages/types/src/index.ts)
- `CheckConstraintMetadata { name: string; sql: string }`
- `ColumnMetadata.computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED'`
- `ColumnMetadata.comment?: string`
- `EntityMetadata.checkConstraints?: CheckConstraintMetadata[]`
- `EntityMetadata.comment?: string`
- `ColumnDef.comment?: string` (DiffTypes.ts)
- `TableSnapshot.checkConstraints?: ...` and `.comment?` (DiffTypes.ts)

## MetadataRegistry (packages/metadata/src/MetadataRegistry.ts)
- `setCheckConstraints(target, constraints)`
- `setEntityComment(target, comment)`

## EntityMetadataBuilder (packages/metadata/src/EntityMetadata.ts)
- `setCheckConstraints(constraints)`
- `setEntityComment(comment)`

## DDL Emission

### Computed Columns
- Already handled by existing ColumnHandlers.renderColumn() and dialect strategies
- hasComputedColumnSql sets computedStorage='STORED' or 'VIRTUAL'
- MSSQL treats both 'STORED' and 'PERSISTED' as PERSISTED

### CHECK Constraints
- Appended to CREATE TABLE column list after PRIMARY KEY
- PostgreSQL: `CONSTRAINT "name" CHECK (sql)`
- MySQL: `CONSTRAINT \`name\` CHECK (sql)`
- MSSQL: `CONSTRAINT [name] CHECK (sql)`

### COMMENT
- PostgreSQL: `generateCommentSql(entityMeta)` returns `COMMENT ON TABLE/COLUMN ...` statements
- MySQL: inline `COMMENT '...'` on columns; `COMMENT='...'` table option in CREATE TABLE
- MSSQL: `generateCommentSql(entityMeta)` returns `EXEC sp_addextendedproperty ...` statements

## Converter + DefaultValue
- SchemaSnapshot.buildExpectedFromMetadata() applies column.converter.toProvider(defaultValue) when both are set
- Ensures provider-side value is stored in DDL, not model-side value

## INSERT/UPDATE Skip
- batch-grouper.ts already filters isComputed=true columns from INSERT/UPDATE
- hasComputedColumnSql sets isComputed=true, so computed columns are automatically excluded
