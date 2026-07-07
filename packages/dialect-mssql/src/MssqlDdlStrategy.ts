import { AbstractDdlStrategy, type DdlLoggerLike } from '@ts-linq/dialect-kit';
import type { ColumnMetadata, DdlStrategy, EntityMetadata } from '@ts-linq/types';

import { MssqlIndexBuilder } from './builders/MssqlIndexBuilder';
import { MssqlTypeMapper } from './MssqlTypeMapper';
import { quoteIdentifier, quoteStringLiteral } from './quoting';

/**
 * SQL Server DDL strategy. The invariant CREATE TABLE / ALTER / FK / constraint / comment algorithms
 * live in {@link AbstractDdlStrategy}; this class supplies only the T-SQL `TypeMapper` and the
 * divergent hooks (`IF NOT EXISTS sys.tables`, `IDENTITY(1,1)`, computed `AS (…) PERSISTED`,
 * `sp_rename`, `sp_addextendedproperty` comments).
 */
export class MssqlDdlStrategy extends AbstractDdlStrategy implements DdlStrategy {
  protected readonly typeMapper = new MssqlTypeMapper();
  protected readonly addColumnClause = 'ADD';
  private readonly indexBuilder: MssqlIndexBuilder;

  constructor(logger?: DdlLoggerLike) {
    super(logger);
    this.indexBuilder = new MssqlIndexBuilder(logger);
  }

  protected quoteIdentifier(identifier: string): string {
    return quoteIdentifier(identifier);
  }

  protected quoteStringLiteral(value: string): string {
    return quoteStringLiteral(value);
  }

  /** Public logical→physical type map. Retained for backward compatibility (delegates to the mapper). */
  public mapTypeToMssql(type: string): string {
    return this.typeMapper.mapType(type);
  }

  public generateCreateIndexSql(
    tableName: string,
    index: {
      name: string;
      columns: string[];
      unique: boolean;
      where?: string;
      orders?: { [column: string]: 'ASC' | 'DESC' };
      include?: string[];
    }
  ): string {
    return this.indexBuilder.buildCreateIndexSql(tableName, index);
  }

  protected wrapCreateTable(metadata: EntityMetadata, body: string): string {
    return `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = ${this.quoteStringLiteral(metadata.tableName)}) BEGIN CREATE TABLE ${this.quoteIdentifier(metadata.tableName)} (${body}) END`;
  }

  protected renderComputedColumn(column: Omit<ColumnMetadata, 'propertyName'>): string {
    const storage = column.computedStorage;
    if (storage && storage !== 'PERSISTED') {
      this.logger?.warn(
        `MSSQL: computedStorage='${storage}' is not supported; use 'PERSISTED' or omit. Applying non-persisted computed for ${column.columnName}`
      );
    }
    const persisted = storage === 'PERSISTED' || storage === 'STORED' ? ' PERSISTED' : '';
    return `${this.quoteIdentifier(column.columnName)} AS (${column.computedExpression})${persisted}`;
  }

  protected renderScalarColumn(column: Omit<ColumnMetadata, 'propertyName'>): string {
    let definition = `${this.quoteIdentifier(column.columnName)} ${this.typeMapper.mapType(column.type, column.length)}`;
    if (column.isGenerated) definition += ' IDENTITY(1,1)';
    if (!column.nullable) definition += ' NOT NULL';
    definition += this.renderDefault(column);
    return definition;
  }

  protected renderAlterColumnType(columnName: string, mappedType: string): string {
    return `ALTER COLUMN ${this.quoteIdentifier(columnName)} ${mappedType}`;
  }

  protected renderDropUniqueConstraint(name: string): string {
    return `DROP CONSTRAINT ${this.quoteIdentifier(name)}`;
  }

  public generateRenameTableSql(tableName: string, newTableName: string): string {
    return `EXEC sp_rename ${this.quoteStringLiteral(tableName)}, ${this.quoteStringLiteral(newTableName)}`;
  }

  protected renderTableComment(tableName: string, comment: string): string {
    return `EXEC sp_addextendedproperty 'MS_Description', N${this.quoteStringLiteral(comment)}, 'SCHEMA', N'dbo', 'TABLE', N${this.quoteStringLiteral(tableName)}`;
  }

  protected renderColumnComment(tableName: string, column: ColumnMetadata): string {
    return `EXEC sp_addextendedproperty 'MS_Description', N${this.quoteStringLiteral(column.comment as string)}, 'SCHEMA', N'dbo', 'TABLE', N${this.quoteStringLiteral(tableName)}, 'COLUMN', N${this.quoteStringLiteral(column.columnName)}`;
  }
}
