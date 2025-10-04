import type { SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/core';
import { SQLiteWhereEmitter } from '../providers/sqlite/emitters/SQLiteWhereEmitter';
import { SQLiteJoinEmitter } from '../providers/sqlite/emitters/SQLiteJoinEmitter';
import { SQLiteOrderEmitter } from '../providers/sqlite/emitters/SQLiteOrderEmitter';
import { SQLiteGroupEmitter } from '../providers/sqlite/emitters/SQLiteGroupEmitter';

export class SQLiteDialect implements SqlDialect {
  private readonly whereEmitter = new SQLiteWhereEmitter();
  private readonly joinEmitter = new SQLiteJoinEmitter();
  private readonly orderEmitter = new SQLiteOrderEmitter();
  private readonly groupEmitter = new SQLiteGroupEmitter();
  public quoteIdentifier(identifier: string): string { return identifier; }
  public buildSelect<T>(entityClass: new () => T, options: QueryOptions): { query: string; parameters: readonly SqlParameter[] } {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const parameters: SqlParameter[] = [];
    let query = this.buildSelectHead(options);
    query += this.buildFromClause(options.from ?? metadata.tableName);
    query += this.joinEmitter.emit(options);
    this.collectSelectParams(parameters, options);
    query += this.whereEmitter.emit(parameters, options);
    query += this.groupEmitter.emit(parameters, options);
    query += this.orderEmitter.emit(options);
    query += this.buildLimitOffset(options);
    return { query, parameters };
  }
  private buildSelectHead(options: QueryOptions): string {
    let head = 'SELECT ';
    if (options.distinct) head += 'DISTINCT ';
    head += options.select && options.select.length ? options.select.join(', ') : '*';
    return head;
  }
  private buildFromClause(tableName: string): string { return ` FROM ${tableName}`; }
  private collectSelectParams(parameters: SqlParameter[], options: QueryOptions): void { if (options.selectParams?.length) parameters.push(...options.selectParams); }
  private buildLimitOffset(options: QueryOptions): string {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) return ` LIMIT ${options.limit}` + (hasOffset ? ` OFFSET ${options.offset}` : '');
    if (hasOffset) return ` LIMIT -1 OFFSET ${options.offset}`;
    return '';
  }
}


