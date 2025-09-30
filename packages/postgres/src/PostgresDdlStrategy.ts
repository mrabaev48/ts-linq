import type { EntityMetadata } from '@ts-linq/core';

type LoggerPort = { warn(message: string): void };

export class PostgresDdlStrategy {
  constructor(private readonly logger?: LoggerPort) {}
  public generateCreateTableSql(entityMetadata: EntityMetadata): string {
    const columnSqls = entityMetadata.columns.map((column) => {
      if (column.isComputed && column.computedExpression) {
        // PostgreSQL supports only STORED
        const storage = (column as { computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED' })
          .computedStorage;
        if (storage && storage !== 'STORED') {
          this.logger?.warn(
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
    const uniqueKeyword = this.buildUniqueKeyword(index);
    const concurrently = this.buildConcurrently(index);
    const using = this.buildUsing(index);
    const columnsListSql = this.buildIndexColumnsList(index);
    const withSql = this.buildWithParams(index.withParams);
    const whereSql = this.buildWhere(index);
    return this.composeCreateIndexSql(
      table,
      index.name,
      uniqueKeyword,
      concurrently,
      using,
      columnsListSql,
      withSql,
      whereSql
    );
  }

  private warnIfCollationWithNonBtree(index: {
    name: string;
    using?: 'btree' | 'hash' | 'gin' | 'gist';
    collations?: { [column: string]: string };
  }): void {
    const hasCollations = !!index.collations && Object.keys(index.collations).length > 0;
    const method = index.using || 'btree';
    if (hasCollations && method !== 'btree') {
      this.logger?.warn(
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
    for (const col of index.columns) parts.push(this.formatIndexColumn(col, index));
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

  private formatIndexColumn(
    column: string,
    index: {
      orders?: { [column: string]: 'ASC' | 'DESC' };
      collations?: { [column: string]: string };
      nulls?: { [column: string]: 'FIRST' | 'LAST' };
    }
  ): string {
    const ord = index.orders?.[column] ? ` ${index.orders[column]}` : '';
    const coll = index.collations?.[column] ? ` COLLATE ${index.collations[column]}` : '';
    const nulls = index.nulls?.[column] ? ` NULLS ${index.nulls[column]}` : '';
    return `"${column}"${ord}${coll}${nulls}`;
  }

  private buildUniqueKeyword(index: { unique: boolean }): string {
    return index.unique ? 'UNIQUE ' : '';
  }

  private buildConcurrently(index: { concurrently?: boolean }): string {
    return index.concurrently ? ' CONCURRENTLY' : '';
  }

  private buildUsing(index: { using?: 'btree' | 'hash' | 'gin' | 'gist' }): string {
    return index.using ? ` USING ${index.using.toUpperCase()}` : '';
  }

  private buildWhere(index: { where?: string }): string {
    return index.where ? ` WHERE ${index.where}` : '';
  }

  private composeCreateIndexSql(
    table: string,
    name: string,
    unique: string,
    concurrently: string,
    using: string,
    columnsListSql: string,
    withSql: string,
    whereSql: string
  ): string {
    return `CREATE ${unique}INDEX${concurrently} IF NOT EXISTS "${name}" ON "${table}"${using} (${columnsListSql})${withSql}${whereSql}`;
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
