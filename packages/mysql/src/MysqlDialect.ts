import type { SqlDialect, QueryOptions, SqlParameter } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/core';
import { MySqlWhereEmitter } from './emitters/MySqlWhereEmitter';
import { MySqlJoinEmitter } from './emitters/MySqlJoinEmitter';
import { MySqlOrderEmitter } from './emitters/MySqlOrderEmitter';
import { MySqlGroupEmitter } from './emitters/MySqlGroupEmitter';

/**
 * MySQL dialect for SELECT generation.
 *
 * - Uses LIMIT and OFFSET (LIMIT n OFFSET m)
 * - Leaves '?' placeholders as-is (mysql2 supports positional params)
 */
export class MysqlDialect implements SqlDialect {
  private readonly whereEmitter = new MySqlWhereEmitter();
  private readonly joinEmitter = new MySqlJoinEmitter();
  private readonly orderEmitter = new MySqlOrderEmitter();
  private readonly groupEmitter = new MySqlGroupEmitter();
  public quoteIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }
  /**
   * Build SELECT for MySQL based on normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name
   * @param options Normalized query options (select/where/order/joins/group/limit/offset)
   */
  public buildSelect<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
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

  private buildFromClause(tableName: string): string {
    return ` FROM \`${tableName}\``;
  }

  private collectSelectParams(parameters: SqlParameter[], options: QueryOptions): void {
    if (options.selectParams && options.selectParams.length)
      parameters.push(...options.selectParams);
  }

  private buildLimitOffset(options: QueryOptions): string {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      return ` LIMIT ${options.limit}` + (hasOffset ? ` OFFSET ${options.offset}` : '');
    }
    if (hasOffset) {
      return ` LIMIT 18446744073709551615 OFFSET ${options.offset}`;
    }
    return '';
  }
}
