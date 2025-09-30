import type { EntityMetadata } from '@ts-linq/core';
import type { PgIndexSpec } from './builders/PgIndexBuilder';
import { PgIndexBuilder } from './builders/PgIndexBuilder';

type LoggerPort = { warn(message: string): void };

export class PostgresDdlStrategy {
  private readonly indexBuilder: PgIndexBuilder;

  constructor(private readonly logger?: LoggerPort) {
    this.indexBuilder = new PgIndexBuilder(logger);
  }
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
    return this.indexBuilder.buildCreateIndexSql(table, index as PgIndexSpec);
  }

  // index helpers relocated to PgIndexBuilder

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
