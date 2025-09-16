import { EntityMetadata, ColumnMetadata, SqlHelper } from '@ts-linq/core';

export class SQLiteDdlStrategy {
  public generateCreateTableSql(metadata: EntityMetadata): string {
    if (!metadata || !metadata.columns) {
      throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
    }
    const columns = metadata.columns.map((col) => this.generateColumnDefinition(col));

    if (metadata.primaryKeys.length > 0) {
      const primaryKeyColumns = metadata.primaryKeys.map((pk) => {
        const column = metadata.columns.find((c) => c.propertyName === pk);
        return column ? column.columnName : pk;
      });

      // Special handling for SQLite AUTOINCREMENT
      if (metadata.primaryKeys.length === 1) {
        const pkColumn = metadata.columns.find((c) => c.propertyName === metadata.primaryKeys[0]);
        if (pkColumn && pkColumn.isGenerated && this.mapTypeToSQLite(pkColumn.type) === 'INTEGER') {
          const pkIndex = metadata.columns.findIndex(
            (c) => c.propertyName === metadata.primaryKeys[0]
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
    index: { name: string; columns: string[]; unique: boolean }
  ): string {
    const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
    return `CREATE ${uniqueKeyword}INDEX IF NOT EXISTS ${index.name} ON ${tableName} (${index.columns.join(', ')})`;
  }

  public generateColumnDefinition(column: ColumnMetadata): string {
    let definition = `${column.columnName} ${this.mapTypeToSQLite(column.type)}`;

    if (column.length) {
      definition += `(${column.length})`;
    }

    if (column.isGenerated && this.mapTypeToSQLite(column.type) === 'INTEGER') {
      // Skip extra constraints; PRIMARY KEY AUTOINCREMENT handled at table level
    } else {
      if (!column.nullable) {
        definition += ' NOT NULL';
      }

      if (column.defaultValue !== undefined) {
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
