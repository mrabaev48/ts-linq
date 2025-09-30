import type { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
import { SqlHelper } from '@ts-linq/core';

import type { Logger } from '@ts-linq/core';

export class MssqlDdlStrategy {
  constructor(private readonly logger?: Logger) {}
  public generateCreateTableSql(metadata: EntityMetadata): string {
    if (!metadata || !metadata.columns) {
      throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
    }
    const columns: string[] = metadata.columns.map((column: ColumnMetadata) =>
      this.generateColumnDefinition(column)
    );
    if (metadata.primaryKeys.length > 0) {
      const primaryKeyColumns = metadata.primaryKeys.map((pk) => {
        const col = metadata.columns.find((column) => column.propertyName === pk);
        return col ? col.columnName : pk;
      });
      columns.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
    }
    return `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '${metadata.tableName}') BEGIN CREATE TABLE ${metadata.tableName} (${columns.join(', ')}) END`;
  }

  public generateColumnDefinition(column: ColumnMetadata): string {
    if (column.isComputed && column.computedExpression) {
      const storage = (column as { computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED' })
        .computedStorage;
      if (storage && storage !== 'PERSISTED') {
        this.logger?.warn(
          `MSSQL: computedStorage='${storage}' is not supported; use 'PERSISTED' or omit. Applying non-persisted computed for ${column.columnName}`
        );
      }
      const persisted = storage === 'PERSISTED' ? ' PERSISTED' : '';
      return `${column.columnName} AS (${column.computedExpression})${persisted}`;
    }
    let definition = `${column.columnName} ${this.mapTypeToMssql(column.type)}`;
    if (column.length) {
      definition += `(${column.length})`;
    }
    if (!column.nullable) definition += ' NOT NULL';
    if ((column as { defaultExpression?: string }).defaultExpression) {
      definition += ` DEFAULT ${(column as { defaultExpression?: string }).defaultExpression}`;
    } else if (column.defaultValue !== undefined) {
      definition += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
    }
    return definition;
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
    // MSSQL does not support expression-based columns in simple CREATE INDEX list
    // Warn if caller passed unexpected props via type erasure
    const unexpected: string[] = [];
    if ((index as unknown as { expressions?: string[] }).expressions)
      unexpected.push('expressions');
    if ((index as unknown as { collations?: Record<string, string> }).collations)
      unexpected.push('collations');
    if ((index as unknown as { nulls?: Record<string, 'FIRST' | 'LAST'> }).nulls)
      unexpected.push('nulls');
    if (unexpected.length > 0) {
      this.logger?.warn(
        `MSSQL: unsupported index options ignored for ${index.name}: ${unexpected.join(', ')}`
      );
    }
    const unique = index.unique ? 'UNIQUE ' : '';
    const whereSql = index.where ? ` WHERE ${index.where}` : '';
    const cols = index.columns
      .map((c) => (index.orders?.[c] ? `${c} ${index.orders[c]}` : c))
      .join(', ');
    const include =
      index.include && index.include.length > 0 ? ` INCLUDE (${index.include.join(', ')})` : '';
    return `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${index.name}' AND object_id=OBJECT_ID('${tableName}')) CREATE ${unique}INDEX ${index.name} ON ${tableName} (${cols})${include}${whereSql}`;
  }

  public mapTypeToMssql(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'TEXT':
      case 'STRING':
        return 'NVARCHAR(MAX)';
      case 'INTEGER':
      case 'NUMBER':
        return 'INT';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'FLOAT';
      case 'BOOLEAN':
        return 'BIT';
      case 'DATETIME':
      case 'DATE':
        return 'DATETIME2';
      case 'BLOB':
        return 'VARBINARY(MAX)';
      case 'UUID':
        return 'UNIQUEIDENTIFIER';
      default:
        return 'NVARCHAR(MAX)';
    }
  }
}
