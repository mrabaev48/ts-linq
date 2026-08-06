import type { Dialect } from '../Dialect';
import { QuoterFactory } from './quoting/QuoterFactory';

/**
 * Back-compat facade over the audited per-dialect {@link SqlQuoter}. Escapes embedded
 * quote characters and wraps the identifier. Kept for existing callers; new code may use
 * `QuoterFactory.for(dialect)` directly.
 */
export function q(dialect: Dialect, id: string): string {
  return QuoterFactory.for(dialect).id(id);
}

/**
 * Back-compat facade over the audited per-dialect {@link SqlQuoter} literal encoder.
 * Folded into the single `literal()` path so identifier and value encoding share one
 * auditable authority. Kept for existing callers.
 */
export function formatValue(dialect: Dialect, v: unknown): string {
  return QuoterFactory.for(dialect).literal(v);
}

export function norm(t: string): string {
  return String(t || '')
    .trim()
    .toUpperCase();
}
