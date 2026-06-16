/**
 * String-based event ID catalog mirroring EF Core's CoreEventId and RelationalEventId.
 * Use these constants as arguments to WarningConfigurationBuilder.throw() / .log() / .suppress().
 */

export const CoreEventId = {
  firstWithoutOrderByAndFilterWarning: 'core.first-without-order-by-and-filter',
  clientEvaluationWarning: 'core.client-evaluation',
  sensitiveDataLoggingEnabled: 'core.sensitive-data-logging-enabled',
  queryStart: 'core.query-start',
  queryEnd: 'core.query-end',
  queryError: 'core.query-error',
  transactionStart: 'core.transaction-start',
  transactionEnd: 'core.transaction-end',
  retry: 'core.retry',
  cache: 'core.cache',
  cacheSize: 'core.cache-size',
  connectionHealth: 'core.connection-health',
  circuit: 'core.circuit-open',
  fallback: 'core.fallback',
  hedgedWin: 'core.hedged-win',
  analysis: 'core.analysis'
} as const;

export const RelationalEventId = {
  multipleCollectionIncludeWarning: 'relational.multiple-collection-include',
  queryPossibleExpressionWarning: 'relational.query-possible-expression-warning',
  crossQuery: 'relational.cross-query-chunk'
} as const;

/** Loosely-typed event identifier — any string is valid for custom events. */
export type EventId = string;
