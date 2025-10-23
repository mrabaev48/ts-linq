import type { EntityMetadata, ColumnMetadata } from '@ts-linq/types';
import { SqlHelper } from '@ts-linq/core';

type LoggerLike = { warn(message: string, error?: unknown): void };
import { SQLiteIndexBuilder } from './builders/SQLiteIndexBuilder';

export class SQLiteDdlStrategy {
  private readonly indexBuilder: SQLiteIndexBuilder;
  constructor(private readonly logger?: LoggerLike) {
    this.indexBuilder = new SQLiteIndexBuilder(logger);
  }
  public generateCreateTableSql(metadata: EntityMetadata): string {
    if (!metadata || !metadata.columns) {
      throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
    }
    const columns = metadata.columns.map((col: any) => this.generateColumnDefinition(col));

    if (metadata.primaryKeys.length > 0) {
      const primaryKeyColumns = metadata.primaryKeys.map((pk: any) => {
        const column = metadata.columns.find((c: any) => c.propertyName === pk);
        return column ? column.columnName : pk;
      });

      // Special handling for SQLite AUTOINCREMENT
      if (metadata.primaryKeys.length === 1) {
        const pkColumn = metadata.columns.find((c: any) => c.propertyName === metadata.primaryKeys[0]);
        if (pkColumn && pkColumn.isGenerated && this.mapTypeToSQLite(pkColumn.type) === 'INTEGER') {
          const pkIndex = metadata.columns.findIndex(
            (c: any) => c.propertyName === metadata.primaryKeys[0]
          );
          columns[pkIndex] += ' PRIMARY KEY AUTOINCREMENT';
        } else {
          columns.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
        }
      } else {
        columns.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
      }
    }

    return `CREATE TABLE IF NOT EXISTS ${metadata.tableName} (${columns.join(', ')})`;
  }

  public generateCreateIndexSql(
    tableName: string,
    index: {
      name: string;
      columns: string[];
      unique: boolean;
      where?: string;
      orders?: { [column: string]: 'ASC' | 'DESC' };
      expressions?: string[];
      collations?: { [column: string]: string };
    }
  ): string {
    return this.indexBuilder.buildCreateIndexSql(tableName, index);
  }

  public generateColumnDefinition(column: ColumnMetadata): string {
    if (column.isComputed && column.computedExpression) {
      const storage = (column as { computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED' })
        .computedStorage;
      const kind = storage === 'STORED' ? 'STORED' : 'VIRTUAL';
      if (storage && storage !== 'STORED' && storage !== 'VIRTUAL') {
        this.logger?.warn(
          `SQLite: computedStorage='${storage}' is not supported (use 'VIRTUAL' or 'STORED'); using ${kind} for ${column.columnName}`
        );
      }
      if (kind === 'STORED') {
        this.logger?.warn(
          `SQLite: STORED generated columns require SQLite >= 3.31; falling back to VIRTUAL for ${column.columnName}`
        );
      }
      return `${column.columnName} GENERATED ALWAYS AS (${column.computedExpression}) ${kind}`;
    }
    let definition = `${column.columnName} ${this.mapTypeToSQLite(column.type)}`;

    if (column.length) {
      definition += `(${column.length})`;
    }

    const isIntegerAutoincPk =
      column.isGenerated && this.mapTypeToSQLite(column.type) === 'INTEGER';
    if (!isIntegerAutoincPk) {
      if (!column.nullable) {
        definition += ' NOT NULL';
      }

      const defExpr = (column as { defaultExpression?: string }).defaultExpression;
      if (defExpr) {
        definition += ` DEFAULT ${defExpr}`;
      } else if (column.defaultValue !== undefined) {
        definition += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
      }
    }

    return definition;
  }

  public mapTypeToSQLite(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'TEXT':
      case 'STRING':
        return 'TEXT';
      case 'INTEGER':
      case 'NUMBER':
        return 'INTEGER';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'REAL';
      case 'BOOLEAN':
        return 'INTEGER';
      case 'DATETIME':
      case 'DATE':
        return 'TEXT';
      case 'BLOB':
        return 'BLOB';
      default:
        return 'TEXT';
    }
  }
}
