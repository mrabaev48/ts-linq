import {
  type ColumnMetadata,
  type CreateIndexSpec,
  type DdlStrategy,
  type EntityMetadata,
  type ForeignKeySpec,
  MetadataError,
  type TypeMapper
} from '@ts-linq/types';

import { formatValue } from '../params/format-value';

/** Minimal logger surface used for non-fatal DDL warnings (unsupported computed storage, etc.). */
export type DdlLoggerLike = { warn(message: string, error?: unknown): void };

/**
 * Shared base for the DDL strategies (Template Method). Owns the invariant CREATE TABLE / ALTER /
 * FK / unique-constraint / comment algorithms; the only dialect-variable concerns are injected:
 *
 * - a {@link TypeMapper} strategy (logical→physical type map),
 * - the per-dialect identifier/string-literal quoting (task-3 helpers, wired through the abstract
 *   `quoteIdentifier`/`quoteStringLiteral` methods),
 * - a handful of protected hooks for the genuinely divergent fragments (CREATE TABLE wrapper,
 *   scalar/computed column rendering, ALTER-COLUMN clause, DROP-unique clause, comment statements).
 *
 * The base depends inward on the `@ts-linq/types` contract only and never imports a concrete
 * dialect — it is the single source of truth for cross-dialect DDL, replacing the triplicated
 * CREATE-TABLE algorithm + FK/constraint/comment emitters previously copy-pasted across the three
 * `*DdlStrategy` classes.
 */
export abstract class AbstractDdlStrategy implements DdlStrategy {
  constructor(protected readonly logger?: DdlLoggerLike) {}

  /** Per-dialect logical→physical type map (Strategy). Supplied by each concrete dialect. */
  protected abstract readonly typeMapper: TypeMapper;

  /** Clause that introduces a column in `ALTER TABLE … ADD` (`'ADD COLUMN'` or, for MSSQL, `'ADD'`). */
  protected abstract readonly addColumnClause: string;

  /** Quote an identifier (table/column/constraint name). Delegates to the dialect's task-3 helper. */
  protected abstract quoteIdentifier(identifier: string): string;

  /** Quote a string literal for a SQL string-literal position. Delegates to the task-3 helper. */
  protected abstract quoteStringLiteral(value: string): string;

  // ─── CREATE TABLE ─────────────────────────────────────────────────────────────

  public generateCreateTableSql(metadata: EntityMetadata): string {
    if (!metadata || !metadata.columns) {
      throw new MetadataError(
        `Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`
      );
    }
    const parts = metadata.columns.map((column) => this.generateColumnDefinition(column));
    const primaryKey = this.buildPrimaryKeyClause(metadata);
    if (primaryKey) parts.push(primaryKey);
    parts.push(...this.buildCheckConstraints(metadata));
    return this.wrapCreateTable(metadata, parts.join(', '));
  }

  protected buildPrimaryKeyClause(metadata: EntityMetadata): string | undefined {
    const primaryKeys = metadata.primaryKeys;
    if (!primaryKeys || primaryKeys.length === 0) return undefined;
    const cols = primaryKeys
      .map((pk) =>
        this.quoteIdentifier(
          metadata.columns.find((column) => column.propertyName === pk)?.columnName ?? pk
        )
      )
      .join(', ');
    return `PRIMARY KEY (${cols})`;
  }

  protected buildCheckConstraints(metadata: EntityMetadata): string[] {
    return (metadata.checkConstraints ?? []).map(
      (cc) => `CONSTRAINT ${this.quoteIdentifier(cc.name)} CHECK (${cc.sql})`
    );
  }

  // ─── Column definition ────────────────────────────────────────────────────────

  public generateColumnDefinition(column: Omit<ColumnMetadata, 'propertyName'>): string {
    if (column.isComputed && column.computedExpression) {
      return this.renderComputedColumn(column);
    }
    return this.renderScalarColumn(column);
  }

  /**
   * Shared `DEFAULT …` fragment (leading space included). A `defaultExpression` wins over a literal
   * `defaultValue`; the literal is rendered via the shared {@link formatValue}.
   */
  protected renderDefault(column: Omit<ColumnMetadata, 'propertyName'>): string {
    if (column.defaultExpression) return ` DEFAULT ${column.defaultExpression}`;
    if (column.defaultValue !== undefined) return ` DEFAULT ${formatValue(column.defaultValue)}`;
    return '';
  }

  // ─── ALTER TABLE column ops ───────────────────────────────────────────────────

  public generateAddColumnSql(
    tableName: string,
    column: Omit<ColumnMetadata, 'propertyName'>
  ): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ${this.addColumnClause} ${this.generateColumnDefinition(column)}`;
  }

  public generateDropColumnSql(tableName: string, columnName: string): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} DROP COLUMN ${this.quoteIdentifier(columnName)}`;
  }

  public generateAlterColumnTypeSql(
    tableName: string,
    columnName: string,
    newType: string
  ): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ${this.renderAlterColumnType(columnName, this.typeMapper.mapType(newType))}`;
  }

  /** `ALTER TABLE t RENAME TO t2`. SQL Server overrides (`sp_rename`). */
  public generateRenameTableSql(tableName: string, newTableName: string): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} RENAME TO ${this.quoteIdentifier(newTableName)}`;
  }

  // ─── FK / unique constraints ──────────────────────────────────────────────────

  public generateForeignKeySql(tableName: string, fk: ForeignKeySpec): string {
    let sql = `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD CONSTRAINT ${this.quoteIdentifier(fk.name)} FOREIGN KEY (${this.quoteIdentifier(fk.columnName)}) REFERENCES ${this.quoteIdentifier(fk.relatedTableName)} (${this.quoteIdentifier(fk.relatedColumnName)})`;
    if (fk.onDelete && fk.onDelete !== 'NO ACTION') sql += ` ON DELETE ${fk.onDelete}`;
    if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') sql += ` ON UPDATE ${fk.onUpdate}`;
    return sql;
  }

  /** `ADD CONSTRAINT … UNIQUE (…)`. MySQL overrides (`ADD UNIQUE KEY`). */
  public generateAddUniqueConstraintSql(
    tableName: string,
    name: string,
    columns: string[]
  ): string {
    const cols = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD CONSTRAINT ${this.quoteIdentifier(name)} UNIQUE (${cols})`;
  }

  public generateDropUniqueConstraintSql(tableName: string, name: string): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ${this.renderDropUniqueConstraint(name)}`;
  }

  // ─── Comments ─────────────────────────────────────────────────────────────────
  // Shared loop; PG/MSSQL override the render hooks to emit standalone statements. MySQL inlines
  // comments in CREATE TABLE / the column definition, so it keeps the default no-op hooks → `[]`.

  public generateCommentSql(metadata: EntityMetadata): string[] {
    const stmts: string[] = [];
    if (metadata.comment) {
      const tableStmt = this.renderTableComment(metadata.tableName, metadata.comment);
      if (tableStmt) stmts.push(tableStmt);
    }
    for (const column of metadata.columns) {
      if (column.comment) {
        const columnStmt = this.renderColumnComment(metadata.tableName, column);
        if (columnStmt) stmts.push(columnStmt);
      }
    }
    return stmts;
  }

  // ─── Divergent hooks ──────────────────────────────────────────────────────────

  /** Delegates to the per-dialect index builder. */
  public abstract generateCreateIndexSql(tableName: string, index: CreateIndexSpec): string;

  /** Wrap the assembled column/constraint body in the dialect's CREATE TABLE statement. */
  protected abstract wrapCreateTable(metadata: EntityMetadata, body: string): string;

  /** Render a non-computed column (type + nullability + generated + default + dialect extras). */
  protected abstract renderScalarColumn(column: Omit<ColumnMetadata, 'propertyName'>): string;

  /** Render a computed/generated column (`GENERATED ALWAYS AS …` / MSSQL `AS (…)`). */
  protected abstract renderComputedColumn(column: Omit<ColumnMetadata, 'propertyName'>): string;

  /** Render the `ALTER TABLE t ` suffix that retypes a column. */
  protected abstract renderAlterColumnType(columnName: string, mappedType: string): string;

  /** Render the `ALTER TABLE t ` suffix that drops a unique constraint/index. */
  protected abstract renderDropUniqueConstraint(name: string): string;

  /** Standalone table-comment statement. Default: none (MySQL inlines it in CREATE TABLE). */
  protected renderTableComment(_tableName: string, _comment: string): string {
    return '';
  }

  /** Standalone column-comment statement. Default: none (MySQL inlines it in the column def). */
  protected renderColumnComment(_tableName: string, _column: ColumnMetadata): string {
    return '';
  }
}
