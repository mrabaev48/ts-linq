import { MetadataStorage } from '../metadata/MetadataStorage';
import { JoinType, WhereClause, OrderByClause, GroupByClause, QueryOptions } from '../types';

/**
 * QueryBuilder is now focused solely on generating SQL
 * from an entity class and accumulated query options.
 */
export class QueryBuilder {
    public generateSql<T>(
        entityClass: new () => T,
        options: QueryOptions
    ): { query: string; parameters: any[] } {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        }
        let query = 'SELECT ';
        if (options.distinct) {
            query += 'DISTINCT ';
        }
        if (options.select && options.select.length > 0) {
            query += options.select.join(', ');
        } else {
            query += '*';
        }
        query += ` FROM ${metadata.tableName}`;
        if ((options as any).joins) {
            for (const join of (options as any).joins as Array<{ type: JoinType; table: string; on: string; alias?: string }>) {
                query += ` ${join.type} JOIN ${join.table}`;
                if (join.alias) query += ` AS ${join.alias}`;
                query += ` ON ${join.on}`;
            }
        }
        const parameters: any[] = [];
        if (options.where && options.where.length > 0) {
            const whereClauses = options.where.map(w => (w as any).condition);
            query += ` WHERE ${whereClauses.join(' AND ')}`;
            for (const where of options.where) parameters.push(...(where as any).parameters);
        }
        if (options.groupBy) {
            query += ` GROUP BY ${options.groupBy.columns.join(', ')}`;
            if (options.groupBy.having) {
                query += ` HAVING ${(options.groupBy.having as any).condition}`;
                parameters.push(...(options.groupBy.having as any).parameters);
            }
        }
        if ((options as any).orderBy && (options as any).orderBy.length > 0) {
            const orderByClauses = (options as any).orderBy.map((o: any) => `${o.column} ${o.direction}`);
            query += ` ORDER BY ${orderByClauses.join(', ')}`;
        }
        const hasLimit = options.limit !== undefined && options.limit !== null;
        const hasOffset = options.offset !== undefined && options.offset !== null;
        if (hasLimit) {
            query += ` LIMIT ${options.limit}`;
            if (hasOffset) query += ` OFFSET ${options.offset}`;
        } else if (hasOffset) {
            query += ` LIMIT -1 OFFSET ${options.offset}`;
        }
        return { query, parameters };
    }
}
