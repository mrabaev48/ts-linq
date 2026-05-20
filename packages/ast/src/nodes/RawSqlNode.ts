import type { SqlParameter } from '@ts-linq/types';

/**
 * Source node representing a raw SQL fragment with bound parameters.
 * Used as the FROM-clause source in derived-table wrapping:
 *   FROM (<sql>) AS t0
 *
 * Note: NOT part of ExpressionNode — this is a query-source descriptor, not a predicate.
 */
export interface RawSqlNode {
  readonly type: 'rawSql';
  /** SQL string with '?' positional placeholders (dialect converts later). */
  readonly sql: string;
  readonly params: readonly SqlParameter[];
}
