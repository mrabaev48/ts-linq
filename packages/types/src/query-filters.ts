// Global and named query filters (P0-11)

import type { QueryOptions, WhereClause } from './sql';

// Global filter
export interface GlobalFilter {
  filterName: string;
  entity?: string;
  where?: WhereClause;
  predicate?: (query: QueryOptions) => QueryOptions;
}

// Model-level named query filter (P0-11)
export interface QueryFilterMetadata {
  /** Filter name — `'_default'` for unnamed `hasQueryFilter(pred)` overload. */
  name: string;
  /** Compiled AST node (ExpressionNode at runtime, typed as unknown to avoid @ts-linq/ast dependency). */
  ast: unknown;
  parameters: readonly unknown[];
}
