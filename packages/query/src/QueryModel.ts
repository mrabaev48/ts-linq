import type {
  GroupByClause,
  JoinClause,
  OrderByClause,
  QuerySplittingBehavior,
  SqlParameter,
  WhereClause
} from '@ts-linq/types';

/**
 * Immutable-ish carrier for a query intent. Used by Queryable to
 * accumulate options (with cloning), and by QueryBuilder to generate SQL.
 */
export class QueryModel {
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
    /** When set, overrides `all` and emits the named set operation instead of UNION/UNION ALL. */
    setOp?: 'EXCEPT' | 'INTERSECT';
    other: QueryModel;
    entity: new () => unknown;
  }>;
  from?: string;
  rawSqlSource?: { sql: string; params: readonly SqlParameter[] };
  /** Per-query override of the global query splitting behavior. */
  splittingBehavior?: QuerySplittingBehavior;

  /**
   * Create a deep copy of the query model to preserve immutability
   * when applying read-only operations (e.g., first/any).
   */
  clone(): QueryModel {
    const clonedModel = new QueryModel();
    clonedModel.select = this.select ? [...this.select] : undefined;
    clonedModel.where = this.where
      ? this.where.map((w) => ({ condition: w.condition, parameters: [...w.parameters] }))
      : undefined;
    clonedModel.orderBy = this.orderBy ? this.orderBy.map((o) => ({ ...o })) : undefined;
    clonedModel.groupBy = this.groupBy
      ? {
          columns: [...this.groupBy.columns],
          having: this.groupBy.having
            ? {
                condition: this.groupBy.having.condition,
                parameters: [...this.groupBy.having.parameters]
              }
            : undefined
        }
      : undefined;
    clonedModel.joins = this.joins ? this.joins.map((j) => ({ ...j })) : undefined;
    clonedModel.limit = this.limit;
    clonedModel.offset = this.offset;
    clonedModel.distinct = this.distinct;
    clonedModel.from = this.from;
    clonedModel.rawSqlSource = this.rawSqlSource
      ? { sql: this.rawSqlSource.sql, params: [...this.rawSqlSource.params] }
      : undefined;
    clonedModel.splittingBehavior = this.splittingBehavior;
    clonedModel.unions = this.unions
      ? this.unions.map((unionItem) => ({
          all: unionItem.all,
          setOp: unionItem.setOp,
          other: unionItem.other.clone(),
          entity: unionItem.entity
        }))
      : undefined;
    return clonedModel;
  }
}
