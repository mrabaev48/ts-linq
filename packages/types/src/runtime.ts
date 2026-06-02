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
