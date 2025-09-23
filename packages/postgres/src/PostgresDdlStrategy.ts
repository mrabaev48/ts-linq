import { EntityMetadata, ColumnMetadata, SqlHelper } from '@ts-linq/core';

export class PostgresDdlStrategy {
  public generateCreateTableSql(entityMetadata: EntityMetadata): string {
    const columnSqls = entityMetadata.columns.map((column) => {
      if (column.isComputed && column.computedExpression) {
        // PostgreSQL supports only STORED
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
    index: { name: string; columns: string[]; unique: boolean; where?: string; orders?: { [column: string]: 'ASC' | 'DESC' }; expressions?: string[]; collations?: { [column: string]: string }; nulls?: { [column: string]: 'FIRST' | 'LAST' }; using?: 'btree' | 'hash' | 'gin' | 'gist'; concurrently?: boolean; withParams?: Record<string, string | number | boolean> }
  ): string {
    if (index.collations) {
      for (const k of Object.keys(index.collations)) {
        const method = index.using || 'btree';
        if (method !== 'btree') {
          console.warn(`Postgres: COLLATE is only meaningful with BTREE; using=${method} for index ${index.name}`);
          break;
        }
      }
    }
    const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
    const concurrently = index.concurrently ? ' CONCURRENTLY' : '';
    const using = index.using ? ` USING ${index.using.toUpperCase()}` : '';
    const parts: string[] = [];
    for (const col of index.columns) {
      const ord = index.orders?.[col];
      const collation = index.collations?.[col] ? ` COLLATE ${index.collations![col]}` : '';
      const nulls = index.nulls?.[col] ? ` NULLS ${index.nulls![col]}` : '';
      parts.push(ord ? `"${col}" ${ord}${collation}${nulls}` : `"${col}"${collation}${nulls}`);
    }
    for (const expr of index.expressions || []) {
      parts.push(`(${expr})`);
    }
    const columnsListSql = parts.join(', ');
    const whereSql = index.where ? ` WHERE ${index.where}` : '';
    const withSql = index.withParams && Object.keys(index.withParams).length > 0
      ? ` WITH (${Object.entries(index.withParams).map(([k,v]) => `${k}=${typeof v === 'string' ? `'${v}'` : String(v)}`).join(', ')})`
      : '';
    return `CREATE ${uniqueKeyword}INDEX${concurrently} IF NOT EXISTS "${index.name}" ON "${table}"${using} (${columnsListSql})${withSql}${whereSql}`;
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
