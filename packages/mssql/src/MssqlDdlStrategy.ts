import type { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
import { SqlHelper } from '@ts-linq/core';

type LoggerLike = { warn(message: string, error?: unknown): void };
import { MssqlIndexBuilder } from './builders/MssqlIndexBuilder';

export class MssqlDdlStrategy {
  private readonly indexBuilder: MssqlIndexBuilder;
  constructor(private readonly logger?: LoggerLike) {
    this.indexBuilder = new MssqlIndexBuilder(logger);
  }
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
    return this.indexBuilder.buildCreateIndexSql(tableName, index);
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
