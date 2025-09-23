import { EntityMetadata, ColumnMetadata, SqlHelper } from '@ts-linq/core';

export class MySqlDdlStrategy {
  public generateCreateTableSql(metadata: EntityMetadata): string {
    if (!metadata || !metadata.columns) {
      throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
    }
    const cols: string[] = metadata.columns.map((c) => this.generateColumnDefinition(c));
    if (metadata.primaryKeys.length) {
      const pkCols = metadata.primaryKeys.map(
        (pk) => metadata.columns.find((c) => c.propertyName === pk)?.columnName || pk
      );
      cols.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }
    return `CREATE TABLE IF NOT EXISTS ${metadata.tableName} (${cols.join(', ')})`;
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
    if (index.where) {
      // MySQL ignores partial WHERE in CREATE INDEX (requires functional equivalent)
      console.warn(`MySQL: partial index WHERE is not supported and will be ignored for ${index.name}`);
    }
    if (index.nulls && Object.keys(index.nulls).length > 0) {
      console.warn(`MySQL: NULLS FIRST/LAST is not supported and will be ignored for ${index.name}`);
    }
    // Warn on unsupported computed storage if encountered via DDL (rendering handled in column gen)
    const parts: string[] = [];
    for (const c of index.columns) parts.push(index.orders?.[c] ? `${c} ${index.orders![c]}` : c);
    for (const e of index.expressions || []) parts.push(`(${e})`);
    const cols = parts.join(', ');
    const kind = index.mysqlType ? `${index.mysqlType} ` : index.unique ? 'UNIQUE ' : '';
    const vis = index.mysqlVisibility ? ` ${index.mysqlVisibility}` : '';
    return `CREATE ${kind}INDEX IF NOT EXISTS ${index.name} ON ${table} (${cols})${vis}`;
  }

  public generateColumnDefinition(column: ColumnMetadata): string {
    if (column.isComputed && column.computedExpression) {
      const storage = (column as { computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED' }).computedStorage;
      const kind = storage === 'STORED' ? 'STORED' : 'VIRTUAL';
      return `${column.columnName} ${this.mapTypeToMySql(column.type)} GENERATED ALWAYS AS (${column.computedExpression}) ${kind}`;
    }
    let def = `${column.columnName} ${this.mapTypeToMySql(column.type)}`;
    if (column.length) def += `(${column.length})`;
    if (!column.nullable) def += ' NOT NULL';
    if ((column as { defaultExpression?: string }).defaultExpression) {
      def += ` DEFAULT ${(column as { defaultExpression?: string }).defaultExpression}`;
    } else if (column.defaultValue !== undefined) {
      def += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
    }
    return def;
  }

  public mapTypeToMySql(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'TEXT':
      case 'STRING':
        return 'TEXT';
      case 'INTEGER':
      case 'NUMBER':
        return 'INT';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'DOUBLE';
      case 'BOOLEAN':
        return 'TINYINT(1)';
      case 'DATETIME':
      case 'DATE':
        return 'DATETIME';
      case 'BLOB':
        return 'BLOB';
      default:
        return 'TEXT';
    }
  }
}
