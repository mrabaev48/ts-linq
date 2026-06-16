// Runtime helpers — the only behaviour-carrying module in @ts-linq/types.
//
// Holds the package's trivial, pure, dependency-free runtime helpers: the
// `Result` constructors (`ok`/`err`) and the `isTemplateSqlCache` guard.
// All other modules are type-only. Imports here are type-only by design so the
// module emits nothing but these three functions.

import type { SqlCache, TemplateSqlCache } from './cache';
import type { Result } from './results';

export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/** Type guard for TemplateSqlCache. */
export function isTemplateSqlCache(cache: SqlCache): cache is TemplateSqlCache {
  return typeof (cache as TemplateSqlCache).getTemplate === 'function';
}

/**
 * Redact string literals in a SQL statement so values never leak into traces/metrics.
 *
 * Replaces single- and double-quoted literals with `[REDACTED]`, then applies any
 * caller-supplied `patterns` (e.g. custom secret shapes). Invalid patterns are skipped
 * defensively — this function never throws, so it is always safe on a logging path.
 *
 * Pure and stateless: the single shared redaction unit consumed by every `SqlLogger`
 * implementation. Whether redaction is enabled is the caller's decision; this util
 * unconditionally redacts when called.
 */
export function maskSql(sql: string, patterns?: ReadonlyArray<RegExp>): string {
  let s = sql
    .replace(/'(?:[^']|''+)*'/g, "'[REDACTED]'")
    .replace(/"(?:[^"\\]|\\.)*"/g, '"[REDACTED]"');
  for (const re of patterns ?? []) {
    try {
      s = s.replace(re, '[REDACTED]');
    } catch {
      // ignore invalid regex patterns
    }
  }
  return s;
}
