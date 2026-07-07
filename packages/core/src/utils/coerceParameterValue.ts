import { ParameterCoercionError, type SqlParameter } from '@ts-linq/types';

/**
 * Coerce an arbitrary JS value into a driver-safe {@link SqlParameter} for the non-dialect layer.
 *
 * Primitives, `Date` and `Uint8Array` pass through unchanged; `bigint` is rendered as its decimal
 * string (drivers bind it as text); everything else is JSON-serialized so it can be bound as a text
 * parameter. A value that cannot be serialized (e.g. a circular reference) **fails fast** with a
 * typed {@link ParameterCoercionError} rather than silently degrading to a corrupt
 * `"[object Object]"` parameter. When known, pass `property` (the column/property name) so the
 * thrown error carries actionable context.
 *
 * This is the single source of truth for parameter coercion in `@ts-linq/core` and `@ts-linq/query`
 * (which delegates here). The dialect/provider layer keeps its own canonical tail
 * (`coerceSqlParameter` in `@ts-linq/dialect-kit`) because `core`/`query` must not depend on
 * `dialect-kit` — a deliberate two-tail-by-design.
 *
 * @param value    the raw value to bind
 * @param property optional column/property identifier, surfaced in the error's `details.property`
 * @throws {ParameterCoercionError} when the value cannot be serialized to a driver-safe form
 */
export function coerceParameterValue(value: unknown, property?: string): SqlParameter {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  // `bigint` is not JSON-serializable (JSON.stringify throws); render it as decimal text so it binds
  // cleanly, preserving the pre-fail-fast behavior for this one legitimate non-JSON value.
  if (typeof value === 'bigint') {
    return value.toString();
  }
  try {
    return JSON.stringify(value ?? null);
  } catch (cause) {
    throw new ParameterCoercionError(
      `Failed to coerce parameter${property ? ` for property '${property}'` : ''} to a driver-safe value`,
      { cause, details: { property } }
    );
  }
}
