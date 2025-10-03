import { MetadataStorage } from '@ts-linq/core';
import { PgWhereEmitter } from './emitters/PgWhereEmitter';
import { PgJoinEmitter } from './emitters/PgJoinEmitter';
import { PgOrderEmitter } from './emitters/PgOrderEmitter';
import { PgGroupEmitter } from './emitters/PgGroupEmitter';
export class PostgresDialect {
    constructor() {
        this.whereEmitter = new PgWhereEmitter();
        this.joinEmitter = new PgJoinEmitter();
        this.orderEmitter = new PgOrderEmitter();
        this.groupEmitter = new PgGroupEmitter();
    }
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '"')}`;
    }
    buildSelect(entityClass, options) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const parameters = [];
        let query = this.buildSelectHead(options);
        query = this.applyCte(query, options);
        query += this.buildFromClause(options.from ?? metadata.tableName);
        query += this.joinEmitter.emit(options);
        this.collectSelectParams(parameters, options);
        query += this.whereEmitter.emit(parameters, options);
        query += this.groupEmitter.emit(parameters, options);
        query += this.orderEmitter.emit(options);
        query += this.buildLimitOffset(options);
        query = this.numberPlaceholders(query, parameters.length);
        return { query, parameters };
    }
    numberPlaceholders(sql, paramCount) {
        if (paramCount === 0)
            return sql;
        let index = 0;
        return sql.replace(/\?/g, () => {
            index++;
            return `$${index}`;
        });
    }
    buildSelectHead(options) {
        let head = 'SELECT ';
        if (options.distinct)
            head += 'DISTINCT ';
        head += options.select && options.select.length ? options.select.join(', ') : '*';
        return head;
    }
    applyCte(query, options) {
        if (!options.cte)
            return query;
        return `WITH ${options.cte.name} AS (${options.cte.sql}) ` + query;
    }
    buildFromClause(tableName) {
        return ` FROM \"${tableName}\"`;
    }
    buildJoins(options) {
        if (!options.joins || options.joins.length === 0)
            return '';
        let out = '';
        for (const join of options.joins) {
            out += ` ${join.type} JOIN \"${join.table}\"`;
            if (join.alias)
                out += ` AS ${join.alias}`;
            out += ` ON ${join.on}`;
        }
        return out;
    }
    collectSelectParams(parameters, options) {
        if (options.selectParams && options.selectParams.length) {
            parameters.push(...options.selectParams);
        }
    }
    buildWhereClause(parameters, options) {
        if (!options.where || options.where.length === 0)
            return '';
        const whereClauses = options.where.map((w) => w.condition);
        for (const w of options.where)
            parameters.push(...w.parameters);
        return ` WHERE ${whereClauses.join(' AND ')}`;
    }
    buildGroupByHaving(parameters, options) {
        if (!options.groupBy)
            return '';
        let sql = ` GROUP BY ${options.groupBy.columns.join(', ')}`;
        if (options.groupBy.having) {
            sql += ` HAVING ${options.groupBy.having.condition}`;
            parameters.push(...options.groupBy.having.parameters);
        }
        return sql;
    }
    buildOrderBy(options) {
        if (!options.orderBy || options.orderBy.length === 0)
            return '';
        const orderByClauses = options.orderBy.map((o) => `${o.column} ${o.direction}`);
        return ` ORDER BY ${orderByClauses.join(', ')}`;
    }
    buildLimitOffset(options) {
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
}
//# sourceMappingURL=PostgresDialect.js.map