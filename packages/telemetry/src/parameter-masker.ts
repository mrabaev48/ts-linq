import type { SqlParameter } from '@ts-linq/types';

/**
 * Replace every parameter value with a positional placeholder (:p0, :p1, …).
 * This is the default when sensitiveDataEnabled is false.
 */
export function maskParams(params: readonly SqlParameter[]): readonly SqlParameter[] {
  return params.map((_, i) => `:p${i}` as SqlParameter);
}
