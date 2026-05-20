import { MetadataStorage } from '@ts-linq/metadata';
import type {
  ColumnMetadata,
  EntityMetadata,
  GroupByClause,
  OrderByClause,
  QueryOptions,
  SqlDialect,
  SqlParameter,
  SqlQueryResult,
  SqlWithParams,
  SqlWithReturning,
  WhereClause
} from '@ts-linq/types';

import { PgGroupEmitter } from './emitters/PgGroupEmitter';
import { PgJoinEmitter } from './emitters/PgJoinEmitter';
import { PgOrderEmitter } from './emitters/PgOrderEmitter';
import { PgWhereEmitter } from './emitters/PgWhereEmitter';

/**
 * PostgreSQL implementation of SqlDialect.
 *
 * - Builds SELECT statements with optional JOIN/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT/OFFSET
 * - Converts positional placeholders from '?' to PostgreSQL-style $1..$n
 * - Leaves identifier quoting to providers/metadata (table/column names are passed as-is)
 */
export class PostgresDialect implements SqlDialect {
  private readonly whereEmitter = new PgWhereEmitter();
  private readonly joinEmitter = new PgJoinEmitter();
  private readonly orderEmitter = new PgOrderEmitter();
  private readonly groupEmitter = new PgGroupEmitter();
  public quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
  /**
   * Generate a PostgreSQL SELECT query from normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name
   * @param options Normalized query options (select/where/order/group/joins/limit/offset)
   */
  public buildSelect<T>(entityClass: new () => T, options: QueryOptions): SqlQueryResult {
    const parameters: SqlParameter[] = [];
    let query = this.buildSelectHead(options);
    query = this.applyCte(query, options);
    // SELECT-clause params must precede FROM params so numberPlaceholders assigns
    // correct $N indices (SELECT ? appears before FROM ... ? in the SQL string).
    this.collectSelectParams(parameters, options);
    if (options.rawSqlSource) {
      parameters.push(...options.rawSqlSource.params);
      query += ` FROM (${options.rawSqlSource.sql}) AS t0`;
    } else {
      const metadata = MetadataStorage.getEntity(entityClass);
      if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
      query += this.buildFromClause(options.from ?? metadata.tableName);
    }
    query += this.joinEmitter.emit(options);
    query += this.whereEmitter.emit(parameters, options);
    query += this.groupEmitter.emit(parameters, options);
    query += this.orderEmitter.emit(options);
    query += this.buildLimitOffset(options);
    query = this.numberPlaceholders(query, parameters.length);
    return { query, parameters };
  }

  /** Replace all '?' placeholders by $1..$n according to their order. */
  private numberPlaceholders(sql: string, paramCount: number): string {
    if (paramCount === 0) return sql;
    let index = 0;
    return sql.replace(/\?/g, () => {
      index++;
      return `$${index}`;
    });
  }

  private buildSelectHead(options: QueryOptions): string {
    let head = 'SELECT ';
    if (options.distinct) head += 'DISTINCT ';
    head += options.select && options.select.length ? options.select.join(', ') : '*';
    return head;
  }

  private applyCte(query: string, options: QueryOptions): string {
    if (!options.cte) return query;
    return `WITH ${options.cte.name} AS (${options.cte.sql}) ` + query;
  }

  private buildFromClause(tableName: string): string {
    return ` FROM "${tableName}"`;
  }

  private buildJoins(options: QueryOptions): string {
    if (!options.joins || options.joins.length === 0) return '';
    let out = '';
    for (const join of options.joins) {
      out += ` ${join.type} JOIN "${join.table}"`;
      if (join.alias) out += ` AS ${join.alias}`;
      out += ` ON ${join.on}`;
    }
    return out;
  }

  private collectSelectParams(parameters: SqlParameter[], options: QueryOptions): void {
    if (options.selectParams && options.selectParams.length) {
      parameters.push(...options.selectParams);
    }
  }

  private buildWhereClause(parameters: SqlParameter[], options: QueryOptions): string {
    if (!options.where) return '';
    const whereArray = Array.isArray(options.where) ? options.where : [options.where];
    if (whereArray.length === 0) return '';
    const whereClauses = whereArray.map((w: WhereClause) => w.condition);
    for (const w of whereArray) parameters.push(...w.parameters);
    return ` WHERE ${whereClauses.join(' AND ')}`;
  }

  private buildGroupByHaving(parameters: SqlParameter[], options: QueryOptions): string {
    if (!options.groupBy) return '';
    const groupBy: GroupByClause = Array.isArray(options.groupBy)
      ? { columns: options.groupBy }
      : options.groupBy;
    let sql = ` GROUP BY ${groupBy.columns.join(', ')}`;
    if (groupBy.having) {
      sql += ` HAVING ${groupBy.having.condition}`;
      parameters.push(...groupBy.having.parameters);
    }
    return sql;
  }

  private buildOrderBy(options: QueryOptions): string {
    if (!options.orderBy || options.orderBy.length === 0) return '';
    const orderByClauses = options.orderBy.map((o: OrderByClause) => `${o.column} ${o.direction}`);
    return ` ORDER BY ${orderByClauses.join(', ')}`;
  }

  private buildLimitOffset(options: QueryOptions): string {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      return ` LIMIT ${options.limit}` + (hasOffset ? ` OFFSET ${options.offset}` : '');
    }
    if (hasOffset) {
      return ` OFFSET ${options.offset}`;
    }
    return '';
  }
  public buildInsert(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithReturning {
    const primaryKeys = new Set<string>(metadata.primaryKeys ?? []);
    const hasValue = (propertyName: string): boolean => {
      const v = entity[propertyName];
      return v !== null && v !== undefined;
    };
    const cols = metadata.columns.filter((c) => {
      if (c.isComputed) return false;
      // Never include generated columns unless caller explicitly provided a value
      if (c.isGenerated && !hasValue(c.propertyName)) return false;
      // Heuristic: allow DB-generated PKs when value is missing even if metadata didn't mark it generated.
      // This matches common SERIAL/IDENTITY PK usage while still allowing explicit PK inserts.
      if (primaryKeys.has(c.propertyName) && !hasValue(c.propertyName)) return false;
      return true;
    });
    const names = cols.map((c) => `"${c.columnName}"`);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const parameters: SqlParameter[] = cols.map((c) =>
      this.coerceParameter(entity[c.propertyName])
    );
    const sql = `INSERT INTO "${metadata.tableName}" (${names.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
    return { sql, parameters };
  }

  public buildUpdate(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata
  ): SqlWithParams {
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for ${metadata.tableName}`);
    }
    const primaryKeys = metadata.primaryKeys;
    const setCols = metadata.columns.filter(
      (c) => !primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed
    );
    if (setCols.length === 0) throw new Error('No columns to update');

    const sets = setCols.map((c, i) => `"${c.columnName}" = $${i + 1}`);
    const parameters: SqlParameter[] = setCols.map((c) =>
      this.coerceParameter(entity[c.propertyName])
    );

    if (versionCol) {
      sets.push(`"${versionCol.columnName}" = "${versionCol.columnName}" + 1`);
    }

    const where = primaryKeys.map(
      (pk, i) =>
        `"${metadata.columns.find((c) => c.propertyName === pk)?.columnName || pk}" = $${setCols.length + i + 1}`
    );
    const whereVals: SqlParameter[] = primaryKeys.map((pk) => this.coerceParameter(entity[pk]));
    parameters.push(...whereVals);

    let sql = `UPDATE "${metadata.tableName}" SET ${sets.join(', ')} WHERE ${where.join(' AND ')}`;

    if (versionCol) {
      sql += ` AND "${versionCol.columnName}" = $${parameters.length + 1}`;
      parameters.push(this.coerceParameter(entity[versionCol.propertyName]));
    }

    return { sql, parameters };
  }

  public buildDelete(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithParams {
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for ${metadata.tableName}`);
    }
    const where = metadata.primaryKeys.map(
      (pk, i) =>
        `"${metadata.columns.find((c) => c.propertyName === pk)?.columnName || pk}" = $${i + 1}`
    );
    const parameters: SqlParameter[] = metadata.primaryKeys.map((pk) =>
      this.coerceParameter(entity[pk])
    );
    const sql = `DELETE FROM "${metadata.tableName}" WHERE ${where.join(' AND ')}`;
    return { sql, parameters };
  }

  private coerceParameter(value: unknown): SqlParameter {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date ||
      value instanceof Uint8Array
    ) {
      return value;
    }
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return String(value);
    }
  }
}
