import { WhereClause, OrderByClause, GroupByClause, JoinClause } from '../types';

/**
 * Immutable-ish carrier for a query intent. Used by Queryable to
 * accumulate options (with cloning), and by QueryBuilder to generate SQL.
 */
export class QueryModel {
    public select?: string[];
    public where?: WhereClause[];
    public orderBy?: OrderByClause[];
    public groupBy?: GroupByClause;
    public joins?: JoinClause[];
    public limit?: number;
    public offset?: number;
    public distinct?: boolean;

    public clone(): QueryModel {
        const q = new QueryModel();
        q.select = this.select ? [...this.select] : undefined;
        q.where = this.where ? this.where.map(w => ({ condition: w.condition, parameters: [...w.parameters] })) : undefined;
        q.orderBy = this.orderBy ? this.orderBy.map(o => ({ ...o })) : undefined;
        q.groupBy = this.groupBy ? { columns: [...this.groupBy.columns], having: this.groupBy.having ? { condition: this.groupBy.having.condition, parameters: [...this.groupBy.having.parameters] } : undefined } : undefined;
        q.joins = this.joins ? this.joins.map(j => ({ ...j })) : undefined;
        q.limit = this.limit;
        q.offset = this.offset;
        q.distinct = this.distinct;
        return q;
    }
}


