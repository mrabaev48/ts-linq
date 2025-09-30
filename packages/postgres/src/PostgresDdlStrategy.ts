import type { EntityMetadata } from '@ts-linq/core';

export class PostgresDdlStrategy {
  public generateCreateTableSql(entityMetadata: EntityMetadata): string {
    const columnSqls = entityMetadata.columns.map((column) => {
      if (column.isComputed && column.computedExpression) {
        // PostgreSQL supports only STORED
        const storage = (column as { computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED' })
          .computedStorage;
        if (storage && storage !== 'STORED') {
          console.warn(
            `Postgres: computedStorage='${storage}' is not supported; coercing to STORED for ${column.columnName}`
          );
        }
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
    index: {
      name: string;
      columns: string[];
      unique: boolean;
      where?: string;
      orders?: { [column: string]: 'ASC' | 'DESC' };
      expressions?: string[];
      collations?: { [column: string]: string };
      nulls?: { [column: string]: 'FIRST' | 'LAST' };
      using?: 'btree' | 'hash' | 'gin' | 'gist';
      concurrently?: boolean;
      withParams?: Record<string, string | number | boolean>;
    }
  ): string {
    this.warnIfCollationWithNonBtree(index);
    const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
    const concurrently = index.concurrently ? ' CONCURRENTLY' : '';
    const using = index.using ? ` USING ${index.using.toUpperCase()}` : '';
    const columnsListSql = this.buildIndexColumnsList(index);
    const whereSql = index.where ? ` WHERE ${index.where}` : '';
    const withSql = this.buildWithParams(index.withParams);
    return `CREATE ${uniqueKeyword}INDEX${concurrently} IF NOT EXISTS "${index.name}" ON "${table}"${using} (${columnsListSql})${withSql}${whereSql}`;
  }

  private warnIfCollationWithNonBtree(index: {
    name: string;
    using?: 'btree' | 'hash' | 'gin' | 'gist';
    collations?: { [column: string]: string };
  }): void {
    const hasCollations = !!index.collations && Object.keys(index.collations).length > 0;
    const method = index.using || 'btree';
    if (hasCollations && method !== 'btree') {
      console.warn(
        `Postgres: COLLATE is only meaningful with BTREE; using=${method} for index ${index.name}`
      );
    }
  }

  private buildIndexColumnsList(index: {
    columns: string[];
    orders?: { [column: string]: 'ASC' | 'DESC' };
    collations?: { [column: string]: string };
    nulls?: { [column: string]: 'FIRST' | 'LAST' };
    expressions?: string[];
  }): string {
    const parts: string[] = [];
    for (const col of index.columns) {
      const ord = index.orders?.[col];
      const coll = index.collations?.[col] ? ` COLLATE ${index.collations[col]}` : '';
      const nulls = index.nulls?.[col] ? ` NULLS ${index.nulls[col]}` : '';
      parts.push(ord ? `"${col}" ${ord}${coll}${nulls}` : `"${col}"${coll}${nulls}`);
    }
    for (const expr of index.expressions || []) parts.push(`(${expr})`);
    return parts.join(', ');
  }

  private buildWithParams(withParams?: Record<string, string | number | boolean>): string {
    if (!withParams || Object.keys(withParams).length === 0) return '';
    const body = Object.entries(withParams)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? `'${v}'` : String(v)}`)
      .join(', ');
    return ` WITH (${body})`;
  }

  public mapTypeToPg(type: string): string {
    const key = (type || '').toUpperCase();
    const map: Record<string, string> = {
      TEXT: 'TEXT',
      STRING: 'TEXT',
      INTEGER: 'INTEGER',
      NUMBER: 'INTEGER',
      REAL: 'DOUBLE PRECISION',
      FLOAT: 'DOUBLE PRECISION',
      DOUBLE: 'DOUBLE PRECISION',
      BOOLEAN: 'BOOLEAN',
      DATETIME: 'TIMESTAMPTZ',
      DATE: 'TIMESTAMPTZ',
      BLOB: 'BYTEA',
      UUID: 'UUID',
      JSONB: 'JSONB',
      JSON: 'JSON'
    };
    return map[key] ?? 'TEXT';
  }
}
