import { EntityMetadata, ColumnMetadata, SqlHelper } from '@ts-linq/core';

export class MssqlDdlStrategy {
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
      // MSSQL computed column
      return `${column.columnName} AS (${column.computedExpression})`;
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
    index: { name: string; columns: string[]; unique: boolean }
  ): string {
    const unique = index.unique ? 'UNIQUE ' : '';
    return `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${index.name}' AND object_id=OBJECT_ID('${tableName}')) CREATE ${unique}INDEX ${index.name} ON ${tableName} (${index.columns.join(', ')})`;
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
