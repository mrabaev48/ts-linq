import { MetadataStorage } from '@ts-linq/core';
import { MySqlWhereEmitter } from '../providers/mysql/emitters/MySqlWhereEmitter';
import { MySqlJoinEmitter } from '../providers/mysql/emitters/MySqlJoinEmitter';
import { MySqlOrderEmitter } from '../providers/mysql/emitters/MySqlOrderEmitter';
import { MySqlGroupEmitter } from '../providers/mysql/emitters/MySqlGroupEmitter';
/**
 * MySQL dialect for SELECT generation.
 *
 * - Uses LIMIT and OFFSET (LIMIT n OFFSET m)
 * - Leaves '?' placeholders as-is (mysql2 supports positional params)
 */
export class MysqlDialect {
    constructor() {
        this.whereEmitter = new MySqlWhereEmitter();
        this.joinEmitter = new MySqlJoinEmitter();
        this.orderEmitter = new MySqlOrderEmitter();
        this.groupEmitter = new MySqlGroupEmitter();
    }
    quoteIdentifier(identifier) {
        return `\`${identifier.replace(/`/g, '``')}\``;
    }
    /**
     * Build SELECT for MySQL based on normalized QueryOptions.
     * @param entityClass Entity constructor to resolve table name
     * @param options Normalized query options (select/where/order/joins/group/limit/offset)
     */
    buildSelect(entityClass, options) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
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
        if (options.distinct)
            head += 'DISTINCT ';
        head += options.select && options.select.length ? options.select.join(', ') : '*';
        return head;
    }
    buildFromClause(tableName) {
        return ` FROM \`${tableName}\``;
    }
    collectSelectParams(parameters, options) {
        if (options.selectParams && options.selectParams.length)
            parameters.push(...options.selectParams);
    }
    buildLimitOffset(options) {
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
//# sourceMappingURL=MysqlDialect.js.map