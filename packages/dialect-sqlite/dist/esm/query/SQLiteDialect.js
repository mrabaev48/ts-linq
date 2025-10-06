import { MetadataStorage } from '@ts-linq/core';
import { SQLiteWhereEmitter } from '../providers/sqlite/emitters/SQLiteWhereEmitter';
import { SQLiteJoinEmitter } from '../providers/sqlite/emitters/SQLiteJoinEmitter';
import { SQLiteOrderEmitter } from '../providers/sqlite/emitters/SQLiteOrderEmitter';
import { SQLiteGroupEmitter } from '../providers/sqlite/emitters/SQLiteGroupEmitter';
export class SQLiteDialect {
  constructor() {
    this.whereEmitter = new SQLiteWhereEmitter();
    this.joinEmitter = new SQLiteJoinEmitter();
    this.orderEmitter = new SQLiteOrderEmitter();
    this.groupEmitter = new SQLiteGroupEmitter();
  }
  quoteIdentifier(identifier) {
    return identifier;
  }
  buildSelect(entityClass, options) {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const parameters = [];
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
  buildSelectHead(options) {
    let head = 'SELECT ';
    if (options.distinct) head += 'DISTINCT ';
    head += options.select && options.select.length ? options.select.join(', ') : '*';
    return head;
  }
  buildFromClause(tableName) {
    return ` FROM ${tableName}`;
  }
  collectSelectParams(parameters, options) {
    if (options.selectParams?.length) parameters.push(...options.selectParams);
  }
  buildLimitOffset(options) {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) return ` LIMIT ${options.limit}` + (hasOffset ? ` OFFSET ${options.offset}` : '');
    if (hasOffset) return ` LIMIT -1 OFFSET ${options.offset}`;
    return '';
  }
}
//# sourceMappingURL=SQLiteDialect.js.map
