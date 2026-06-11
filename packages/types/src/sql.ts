// SQL primitives, query options and execution behaviour

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

/**
 * Declarative specification for a dialect-aware junction (many-to-many) read.
 *
 * Describes the read without committing to any SQL text: the provider's
 * capability quotes every identifier through its dialect and binds
 * `whereValues` as parameters, keeping `@ts-linq/core` provider-agnostic.
 */
export interface JunctionQuerySpec {
  /** Junction (through) table name — an unquoted identifier. */
  table: string;
  /** Columns to project — unquoted identifiers; result keys are these names. */
  selectColumns: string[];
  /** Column used in the `WHERE … IN (…)` filter — an unquoted identifier. */
  whereColumn: string;
  /** Parameter values bound to the filter (never interpolated). */
  whereValues: SqlParameter[];
}

/**
 * An unquoted, table-qualified column reference used in a structured JOIN condition.
 * Both `table` and `column` are raw identifiers; the dialect quotes them at render time.
 */
export interface JoinColumnRef {
  readonly table: string;
  readonly column: string;
}

/**
 * A single equi-join condition (`left = right`). A JOIN with several conditions is rendered
 * by the dialect as `left = right AND left = right …`, each identifier quoted per-dialect.
 */
export interface JoinOnCondition {
  readonly left: JoinColumnRef;
  readonly right: JoinColumnRef;
}

export interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  table: string;
  /**
   * Pre-rendered `ON` condition as opaque SQL.
   * @deprecated Carries dialect-specific quoting and is therefore not portable. Prefer
   * `onColumns`, which lets the dialect quote identifiers. Retained as a backward-compatible
   * fallback for callers that still build the string themselves.
   */
  on?: string;
  /**
   * Structured equi-join conditions. When present, the dialect renders the `ON` clause and
   * quotes every identifier with its own `quoteIdentifier`; `on` is ignored.
   */
  onColumns?: readonly JoinOnCondition[];
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
