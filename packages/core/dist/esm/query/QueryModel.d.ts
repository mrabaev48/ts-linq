import type { WhereClause, OrderByClause, GroupByClause, JoinClause } from '../types';
/**
 * Immutable-ish carrier for a query intent. Used by Queryable to
 * accumulate options (with cloning), and by QueryBuilder to generate SQL.
 */
export declare class QueryModel {
  select?: string[];
  where?: WhereClause[];
  orderBy?: OrderByClause[];
  groupBy?: GroupByClause;
  joins?: JoinClause[];
  limit?: number;
  offset?: number;
  distinct?: boolean;
  unions?: Array<{
    all: boolean;
    other: QueryModel;
    entity: new () => unknown;
  }>;
  from?: string;
  /**
   * Create a deep copy of the query model to preserve immutability
   * when applying read-only operations (e.g., first/any).
   */
  clone(): QueryModel;
}
//# sourceMappingURL=QueryModel.d.ts.map
