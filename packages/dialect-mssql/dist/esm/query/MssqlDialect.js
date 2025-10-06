import { MetadataStorage } from '@ts-linq/core';
import { MssqlWhereEmitter } from '../providers/mssql/emitters/MssqlWhereEmitter';
import { MssqlJoinEmitter } from '../providers/mssql/emitters/MssqlJoinEmitter';
import { MssqlOrderEmitter } from '../providers/mssql/emitters/MssqlOrderEmitter';
import { MssqlGroupEmitter } from '../providers/mssql/emitters/MssqlGroupEmitter';
export class MssqlDialect {
  constructor() {
    this.whereEmitter = new MssqlWhereEmitter();
    this.joinEmitter = new MssqlJoinEmitter();
    this.orderEmitter = new MssqlOrderEmitter();
    this.groupEmitter = new MssqlGroupEmitter();
  }
  quoteIdentifier(identifier) {
    return `[${identifier.replace(/]/g, ']]')}]`;
  }
  buildSelect(entityClass, options) {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const parameters = [];
    this.collectSelectParams(parameters, options);
    const selectList = options.select && options.select.length ? options.select.join(', ') : '*';
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    const selectHead = this.buildSelectHead(options, hasLimit, hasOffset);
    let query = `${selectHead}${selectList} FROM [${options.from ?? metadata.tableName}]`;
    query += this.joinEmitter.emit(options);
    query += this.whereEmitter.emit(parameters, options);
    query += this.groupEmitter.emit(parameters, options);
    query += this.orderEmitter.emit(options);
    query += this.buildOffsetFetch(options, hasLimit, hasOffset);
    query = this.numberPlaceholders(query, parameters.length);
    return { query, parameters };
  }
  numberPlaceholders(sql, paramCount) {
    if (paramCount === 0) return sql;
    let index = 0;
    return sql.replace(/\?/g, () => {
      index++;
      return `@p${index}`;
    });
  }
  collectSelectParams(parameters, options) {
    if (options.selectParams && options.selectParams.length)
      parameters.push(...options.selectParams);
  }
  buildSelectHead(options, hasLimit, hasOffset) {
    let head = 'SELECT ';
    if (options.distinct) head += 'DISTINCT ';
    if (hasLimit && !hasOffset) head += `TOP (${options.limit}) `;
    return head;
  }
  buildOffsetFetch(options, hasLimit, hasOffset) {
    if (!hasOffset) return '';
    let sql = '';
    if (!options.orderBy || options.orderBy.length === 0) {
      sql += ' ORDER BY (SELECT NULL)';
    }
    const fetchNext = hasLimit ? ` FETCH NEXT ${options.limit} ROWS ONLY` : '';
    sql += ` OFFSET ${options.offset} ROWS${fetchNext}`;
    return sql;
  }
}
//# sourceMappingURL=MssqlDialect.js.map
