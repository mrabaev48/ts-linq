// SQL-примитивы, query-опции и execution-поведение

export type SqlParameter = string | number | boolean | Date | Uint8Array | null;

// Query types
export interface OrderByClause {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface WhereClause {
  condition: string;
  parameters: readonly SqlParameter[];
}

export interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  table: string;
  on: string;
  alias?: string;
}

export interface GroupByClause {
  columns: string[];
  having?: WhereClause;
}

/**
 * Temporal query mode — mirrors EF Core's five system-versioned table operators.
 * Only supported by MSSQL (SQL Server FOR SYSTEM_TIME clause).
 */
export type TemporalMode = 'AsOf' | 'All' | 'Between' | 'FromTo' | 'ContainedIn';

/**
 * Describes a temporal query constraint to be appended to a FROM clause.
 * `from` is required for AsOf, Between, FromTo, ContainedIn.
 * `to` is required for Between, FromTo, ContainedIn.
 */
export interface TemporalClause {
  readonly mode: TemporalMode;
  readonly from?: Date;
  readonly to?: Date;
}

export interface QueryOptions {
  select?: string[];
  selectParams?: SqlParameter[];
  where?: WhereClause | WhereClause[];
  orderBy?: OrderByClause[];
  joins?: JoinClause[];
  groupBy?: string[] | GroupByClause;
  having?: WhereClause;
  limit?: number;
  offset?: number;
  distinct?: boolean;
  from?: string;
  cte?: { name: string; sql: string };
  rawSqlSource?: { readonly sql: string; readonly params: readonly SqlParameter[] };
  /** Temporal query constraint for SQL Server system-versioned tables (FOR SYSTEM_TIME). */
  temporal?: TemporalClause;
}

// Join type
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

// CTE Definition
export interface CteDefinition {
  name: string;
  query?: string;
  sql?: string;
  parameters?: SqlParameter[];
}

/**
 * Specification for a filtered include — captures the in-memory filter/sort/limit
 * that is applied to related entities after they are fetched from the database.
 * Lives in @ts-linq/types so both @ts-linq/core (EntityLoader) and @ts-linq/query
 * (IncludeSubquery, IncludePlanner) can reference it without creating a circular dep.
 */
export interface FilteredIncludeSpec {
  readonly propertyName: string;
  /**
   * Apply filter/sort/pagination to the full set of related entities for a single parent.
   * Called once per parent with all matching rows; returns the subset to assign.
   */
  applyFilter(items: unknown[]): unknown[];
}

/**
 * Controls whether queries with collection Includes are executed as a single
 * SQL statement with JOINs (SingleQuery) or as a series of separate statements
 * (SplitQuery). Mirrors EF Core's QuerySplittingBehavior.
 *
 * ## SplitQuery (recommended default)
 * Each Include path that targets a collection navigation is loaded via a
 * separate batched IN-query against the database, preventing cartesian-product
 * row explosion at the cost of additional round trips.
 *
 * ## SingleQuery
 * All data is retrieved in a single SQL statement. For queries with multiple
 * collection Includes this can produce cartesian explosion (N × M rows).
 * Prefer this mode only when the result set is known to be small.
 *
 * > **Warning (mirrors EF Core):** Split queries are not transactionally
 * > consistent unless the caller wraps the operation in an explicit transaction.
 */
export enum QuerySplittingBehavior {
  /** One SQL SELECT per collection Include path. Avoids cartesian explosion. */
  SplitQuery = 'SplitQuery',
  /** Single SQL SELECT with JOINs for all Includes. May cause cartesian explosion. */
  SingleQuery = 'SingleQuery'
}
