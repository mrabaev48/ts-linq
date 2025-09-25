import { MetadataStorage } from '@ts-linq/core';
/**
 * MSSQL dialect for SELECT generation.
 *
 * - Adds TOP n when limit is used without offset
 * - Uses OFFSET n ROWS FETCH NEXT m ROWS ONLY when offset is provided
 * - Converts '?' placeholders to @p1..@pn for MSSQL parameter style
 */
export class MssqlDialect {
    quoteIdentifier(identifier) {
        return `[${identifier.replace(/]/g, ']]')}]`;
    }
    /**
     * Build a SELECT statement for MSSQL based on normalized QueryOptions.
     * @param entityClass Entity constructor to resolve table name from metadata
     * @param options Normalized query options (select/where/joins/order/limit/offset)
     * @returns SQL string and positional parameter array
     */
    buildSelect(entityClass, options) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const parameters = [];
        if (options.selectParams && options.selectParams.length) {
            parameters.push(...options.selectParams);
        }
        const selectList = options.select && options.select.length ? options.select.join(', ') : '*';
        // For MSSQL, TOP must appear right after SELECT (before DISTINCT)
        // If both DISTINCT and LIMIT are used, MSSQL supports SELECT DISTINCT TOP (n)
        const hasLimit = options.limit !== undefined && options.limit !== null;
        const hasOffset = options.offset !== undefined && options.offset !== null;
        let selectHead = 'SELECT ';
        if (options.distinct)
            selectHead += 'DISTINCT ';
        if (hasLimit && !hasOffset)
            selectHead += `TOP (${options.limit}) `;
        let query = `${selectHead}${selectList} FROM [${options.from ?? metadata.tableName}]`;
        if (options.joins && options.joins.length > 0) {
            for (const join of options.joins) {
                query += ` ${join.type} JOIN [${join.table}]`;
                if (join.alias)
                    query += ` AS ${join.alias}`;
                query += ` ON ${join.on}`;
            }
        }
        if (options.where && options.where.length > 0) {
            const whereClauses = options.where.map((w) => w.condition);
            query += ` WHERE ${whereClauses.join(' AND ')}`;
            for (const where of options.where)
                parameters.push(...where.parameters);
        }
        // GROUP BY / HAVING
        if (options.groupBy) {
            if (options.groupBy.columns && options.groupBy.columns.length > 0) {
                query += ` GROUP BY ${options.groupBy.columns.join(', ')}`;
            }
            if (options.groupBy.having) {
                query += ` HAVING ${options.groupBy.having.condition}`;
                if (options.groupBy.having.parameters)
                    parameters.push(...options.groupBy.having.parameters);
            }
        }
        if (options.orderBy && options.orderBy.length > 0) {
            const orderByClauses = options.orderBy.map((o) => `${o.column} ${o.direction}`);
            query += ` ORDER BY ${orderByClauses.join(', ')}`;
        }
        // OFFSET/FETCH requires ORDER BY in MSSQL
        if (hasOffset) {
            if (!options.orderBy || options.orderBy.length === 0) {
                // Provide deterministic ordering fallback when missing ORDER BY
                query += ' ORDER BY (SELECT NULL)';
            }
            const fetchNext = hasLimit ? ` FETCH NEXT ${options.limit} ROWS ONLY` : '';
            query += ` OFFSET ${options.offset} ROWS${fetchNext}`;
        }
        // Convert '?' placeholders to @p1..@pn
        query = this.numberPlaceholders(query, parameters.length);
        return { query, parameters };
    }
    /** Replace '?' placeholders with @p1..@pn. */
    numberPlaceholders(sql, paramCount) {
        if (paramCount === 0)
            return sql;
        let index = 0;
        return sql.replace(/\?/g, () => {
            index++;
            return `@p${index}`;
        });
    }
}
//# sourceMappingURL=MssqlDialect.js.map