import { SqlHelper } from '@ts-linq/core';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/types';

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
    if (metadata.primaryKeys && metadata.primaryKeys.length > 0) {
      const pkCols = metadata.primaryKeys.map((pk) => {
        const col = metadata.columns.find((column) => column.propertyName === pk);
        return `[${col ? col.columnName : pk}]`;
      });
      columns.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }
    return `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '${metadata.tableName}') BEGIN CREATE TABLE [${metadata.tableName}] (${columns.join(', ')}) END`;
  }

  public generateColumnDefinition(column: Omit<ColumnMetadata, 'propertyName'>): string {
    if (column.isComputed && column.computedExpression) {
      const storage = (column as { computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED' })
        .computedStorage;
      if (storage && storage !== 'PERSISTED') {
        this.logger?.warn(
          `MSSQL: computedStorage='${storage}' is not supported; use 'PERSISTED' or omit. Applying non-persisted computed for ${column.columnName}`
        );
      }
      const persisted = storage === 'PERSISTED' ? ' PERSISTED' : '';
      return `[${column.columnName}] AS (${column.computedExpression})${persisted}`;
    }
    let sqlType = this.mapTypeToMssql(column.type);
    if (column.length) {
      // Replace (MAX) with the explicit length, or append if no length token present.
      if (sqlType.endsWith('(MAX)')) {
        sqlType = sqlType.slice(0, -5) + `(${column.length})`;
      } else if (!sqlType.includes('(')) {
        sqlType += `(${column.length})`;
      }
    }
    let definition = `[${column.columnName}] ${sqlType}`;
    if (column.isGenerated) {
      definition += ' IDENTITY(1,1)';
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

  public generateAddColumnSql(
    tableName: string,
    column: Omit<ColumnMetadata, 'propertyName'>
  ): string {
    const colDef = this.generateColumnDefinition(column);
    return `ALTER TABLE [${tableName}] ADD ${colDef}`;
  }

  public generateDropColumnSql(tableName: string, columnName: string): string {
    return `ALTER TABLE [${tableName}] DROP COLUMN [${columnName}]`;
  }

  public generateAlterColumnTypeSql(
    tableName: string,
    columnName: string,
    newType: string
  ): string {
    const colDef = `[${columnName}] ${this.mapTypeToMssql(newType)}`;
    return `ALTER TABLE [${tableName}] ALTER COLUMN ${colDef}`;
  }

  public generateRenameTableSql(tableName: string, newTableName: string): string {
    return `EXEC sp_rename '${tableName}', '${newTableName}'`;
  }

  public generateForeignKeySql(
    tableName: string,
    fk: {
      name: string;
      columnName: string;
      relatedTableName: string;
      relatedColumnName: string;
      onDelete?: string;
      onUpdate?: string;
    }
  ): string {
    let sql = `ALTER TABLE [${tableName}] ADD CONSTRAINT [${fk.name}] FOREIGN KEY ([${fk.columnName}]) REFERENCES [${fk.relatedTableName}] ([${fk.relatedColumnName}])`;
    if (fk.onDelete && fk.onDelete !== 'NO ACTION') {
      sql += ` ON DELETE ${fk.onDelete}`;
    }
    if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') {
      sql += ` ON UPDATE ${fk.onUpdate}`;
    }
    return sql;
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
