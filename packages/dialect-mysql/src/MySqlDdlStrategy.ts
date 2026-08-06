import { AbstractDdlStrategy, type DdlLoggerLike } from '@ts-linq/dialect-kit';
import type { ColumnMetadata, DdlStrategy, EntityMetadata, TypeMapper } from '@ts-linq/types';

import { MySqlIndexBuilder } from './builders/MySqlIndexBuilder';
import { MySqlTypeMapper } from './MySqlTypeMapper';
import { quoteIdentifier, quoteStringLiteral } from './quoting';

/**
 * MySQL DDL strategy. The invariant CREATE TABLE / ALTER / FK / constraint algorithms live in
 * {@link AbstractDdlStrategy}; this class supplies only the MySQL `TypeMapper` and the divergent
 * hooks (`AUTO_INCREMENT`, `GENERATED … VIRTUAL|STORED`, `ADD UNIQUE KEY` / `DROP INDEX`).
 *
 * MySQL emits comments **inline** — table-level `COMMENT=` in CREATE TABLE and column `COMMENT` in
 * the column definition — rather than as standalone statements, so it keeps the base's no-op comment
 * hooks (`generateCommentSql` returns `[]`). This inline behavior is an intentional, documented
 * dialect divergence, not copy-paste drift.
 */
export class MySqlDdlStrategy extends AbstractDdlStrategy implements DdlStrategy {
  protected readonly addColumnClause = 'ADD COLUMN';
  private readonly indexBuilder: MySqlIndexBuilder;

  constructor(logger?: DdlLoggerLike, typeMapper: TypeMapper = new MySqlTypeMapper()) {
    super(logger, typeMapper);
    this.indexBuilder = new MySqlIndexBuilder(logger);
  }

  protected quoteIdentifier(identifier: string): string {
    return quoteIdentifier(identifier);
  }

  protected quoteStringLiteral(value: string): string {
    return quoteStringLiteral(value);
  }

  /** Public logical→physical type map. Retained for backward compatibility (delegates to the mapper). */
  public mapTypeToMySql(type: string): string {
    return this.typeMapper.mapType(type);
  }

  public generateCreateIndexSql(
    table: string,
    index: {
      name: string;
      columns: string[];
      unique: boolean;
      where?: string;
      orders?: { [column: string]: 'ASC' | 'DESC' };
      expressions?: string[];
      nulls?: { [column: string]: 'FIRST' | 'LAST' };
      mysqlType?: 'FULLTEXT' | 'SPATIAL';
      mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
    }
  ): string {
    return this.indexBuilder.buildCreateIndexSql(table, index);
  }

  protected wrapCreateTable(metadata: EntityMetadata, body: string): string {
    const tableComment = metadata.comment
      ? ` COMMENT=${this.quoteStringLiteral(metadata.comment)}`
      : '';
    return `CREATE TABLE IF NOT EXISTS ${this.quoteIdentifier(metadata.tableName)} (${body})${tableComment}`;
  }

  protected renderComputedColumn(column: Omit<ColumnMetadata, 'propertyName'>): string {
    const storage = column.computedStorage;
    if (storage && storage !== 'STORED' && storage !== 'VIRTUAL') {
      this.logger?.warn(
        `MySQL: computedStorage='${storage}' is not supported (use 'VIRTUAL' or 'STORED'); falling back to VIRTUAL for ${column.columnName}`
      );
    }
    const kind = storage === 'STORED' ? 'STORED' : 'VIRTUAL';
    return `${this.quoteIdentifier(column.columnName)} ${this.typeMapper.mapType(column.type)} GENERATED ALWAYS AS (${column.computedExpression}) ${kind}`;
  }

  protected renderScalarColumn(column: Omit<ColumnMetadata, 'propertyName'>): string {
    let def = `${this.quoteIdentifier(column.columnName)} ${this.typeMapper.mapType(column.type, column.length)}`;
    if (!column.nullable) def += ' NOT NULL';
    if (column.isGenerated) def += ' AUTO_INCREMENT';
    def += this.renderDefault(column);
    // MySQL supports an inline column COMMENT; other dialects emit separate comment statements.
    if (column.comment) def += ` COMMENT ${this.quoteStringLiteral(column.comment)}`;
    return def;
  }

  protected renderAlterColumnType(columnName: string, mappedType: string): string {
    return `MODIFY COLUMN ${this.quoteIdentifier(columnName)} ${mappedType}`;
  }

  protected renderDropUniqueConstraint(name: string): string {
    return `DROP INDEX ${this.quoteIdentifier(name)}`;
  }

  public generateAddUniqueConstraintSql(
    tableName: string,
    name: string,
    columns: string[]
  ): string {
    const cols = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD UNIQUE KEY ${this.quoteIdentifier(name)} (${cols})`;
  }
}
