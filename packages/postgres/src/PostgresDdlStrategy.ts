import { EntityMetadata, ColumnMetadata, SqlHelper } from '@ts-linq/core';

export class PostgresDdlStrategy {
  public generateCreateTableSql(entityMetadata: EntityMetadata): string {
    const columnSqls = entityMetadata.columns.map((column) => {
      if (column.isComputed && column.computedExpression) {
        // PostgreSQL: GENERATED ALWAYS AS (...) STORED
        return `"${column.columnName}" ${this.mapTypeToPg(column.type)} GENERATED ALWAYS AS (${column.computedExpression}) STORED`;
      }
      const mappedType = this.mapTypeToPg(column.type);
      const notNullSql = column.nullable ? '' : ' NOT NULL';
      const defaultSql = column.defaultExpression ? ` DEFAULT ${column.defaultExpression}` : '';
      return `"${column.columnName}" ${mappedType}${notNullSql}${defaultSql}`;
    });
    if (entityMetadata.primaryKeys.length > 0) {
      const primaryKeySql = entityMetadata.primaryKeys
        .map(
          (primaryKey) =>
            `"${entityMetadata.columns.find((column) => column.propertyName === primaryKey)?.columnName || primaryKey}"`
        )
        .join(', ');
      columnSqls.push(`PRIMARY KEY (${primaryKeySql})`);
    }
    return `CREATE TABLE IF NOT EXISTS "${entityMetadata.tableName}" (${columnSqls.join(', ')})`;
  }

  public generateCreateIndexSql(
    table: string,
    index: { name: string; columns: string[]; unique: boolean; where?: string }
  ): string {
    const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
    const columnsListSql = index.columns.map((column) => `"${column}"`).join(', ');
    const whereSql = index.where ? ` WHERE ${index.where}` : '';
    return `CREATE ${uniqueKeyword}INDEX IF NOT EXISTS "${index.name}" ON "${table}" (${columnsListSql})${whereSql}`;
  }

  public mapTypeToPg(type: string): string {
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
        return 'DOUBLE PRECISION';
      case 'BOOLEAN':
        return 'BOOLEAN';
      case 'DATETIME':
      case 'DATE':
        return 'TIMESTAMPTZ';
      case 'BLOB':
        return 'BYTEA';
      case 'UUID':
        return 'UUID';
      case 'JSONB':
        return 'JSONB';
      case 'JSON':
        return 'JSON';
      default:
        return 'TEXT';
    }
  }
}
