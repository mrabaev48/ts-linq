// Public contract of `@ts-linq/dialect-kit`: shared, stateless SQL clause emitters that every
// dialect composes into its `buildSelect`. Each is a pure function; the only dialect-specific
// concern (identifier quoting) is injected into `emitJoin`. This is the single source of truth for
// clause rendering — dialects must not re-implement these.
export { emitGroup } from './emitters/emitGroup';
export { emitJoin } from './emitters/emitJoin';
export { emitOrder } from './emitters/emitOrder';
export { emitWhere } from './emitters/emitWhere';

// Shared parameter coercion and column-selection utilities — the single source of truth previously
// copy-pasted across each dialect class and its `batch-syntax` module. Per-dialect differences are
// expressed as explicit policy (see InsertableColumnOptions), never as duplicated code branches.
export {
  type InsertableColumnOptions,
  selectInsertableColumns,
  selectUpdatableColumns
} from './columns/select-columns';
export { applyConverter, coerceSqlParameter } from './params/coerce';
export { formatValue } from './params/format-value';
export { numberPlaceholders } from './params/placeholders';

// Shared base DDL strategy (Template Method) — the DDL mirror of the shared SQL base. Owns the
// invariant CREATE TABLE / ALTER / FK / constraint / comment algorithms; each concrete dialect
// supplies a `TypeMapper` plus the divergent hooks. Single source of truth for cross-dialect DDL.
export { AbstractDdlStrategy, type DdlLoggerLike } from './ddl/AbstractDdlStrategy';
// Shared base SQL dialect (Template Method) + injected token strategy (Strategy). The base owns the
// invariant SQL-assembly algorithms; each concrete dialect supplies a `DialectSyntax` plus a few
// divergent hooks. Single source of truth for cross-dialect DML/SELECT assembly.
export { AbstractSqlDialect, type InsertDecoration } from './dialect/AbstractSqlDialect';
export type { DialectSyntax } from './dialect/DialectSyntax';
