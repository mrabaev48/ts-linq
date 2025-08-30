import { SqlDialect } from './SqlDialect';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { QueryOptions } from '../types';

/**
 * MSSQL dialect for SELECT generation.
 *
 * - Adds TOP n when limit is used without offset
 * - Uses OFFSET n ROWS FETCH NEXT m ROWS ONLY when offset is provided
 * - Converts '?' placeholders to @p1..@pn for MSSQL parameter style
 */
export class MssqlDialect implements SqlDialect {
    /**
     * Build a SELECT statement for MSSQL based on normalized QueryOptions.
     * @param entityClass Entity constructor to resolve table name from metadata
     * @param options Normalized query options (select/where/joins/order/limit/offset)
     * @returns SQL string and positional parameter array
     */
    public buildSelect<T>(entityClass: new () => T, options: QueryOptions): { query: string; parameters: any[] } {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);

        const parameters: any[] = [];
        const selectList = options.select && options.select.length ? options.select.join(', ') : '*';

        // For MSSQL, TOP must appear right after SELECT (before DISTINCT)
        // If both DISTINCT and LIMIT are used, MSSQL supports SELECT DISTINCT TOP (n)
        const hasLimit = options.limit !== undefined && options.limit !== null;
        const hasOffset = options.offset !== undefined && options.offset !== null;

        let selectHead = 'SELECT ';
        if (options.distinct) selectHead += 'DISTINCT ';
        if (hasLimit && !hasOffset) selectHead += `TOP (${options.limit}) `;

        let query = `${selectHead}${selectList} FROM ${metadata.tableName}`;

        if ((options as any).joins) {
            for (const join of (options as any).joins as Array<{ type: string; table: string; on: string; alias?: string }>) {
                query += ` ${join.type} JOIN ${join.table}`;
                if (join.alias) query += ` AS ${join.alias}`;
                query += ` ON ${join.on}`;
            }
        }

        if (options.where && options.where.length > 0) {
            const whereClauses = options.where.map(w => (w as any).condition);
            query += ` WHERE ${whereClauses.join(' AND ')}`;
            for (const where of options.where) parameters.push(...(where as any).parameters);
        }

        if ((options as any).orderBy && (options as any).orderBy.length > 0) {
            const orderByClauses = (options as any).orderBy.map((o: any) => `${o.column} ${o.direction}`);
            query += ` ORDER BY ${orderByClauses.join(', ')}`;
        }

        // OFFSET/FETCH requires ORDER BY in MSSQL
        if (hasOffset) {
            if (!(options as any).orderBy || (options as any).orderBy.length === 0) {
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
    private numberPlaceholders(sql: string, paramCount: number): string {
        if (paramCount === 0) return sql;
        let index = 0;
        return sql.replace(/\?/g, () => {
            index++;
            return `@p${index}`;
        });
    }
}


