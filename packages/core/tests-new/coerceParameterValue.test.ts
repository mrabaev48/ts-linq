/**
 * Coercion behavior of the shared non-dialect SSOT tail `coerceParameterValue`.
 *
 * Primitives / null / Date / Uint8Array pass through unchanged; `bigint` renders as its decimal
 * string; plain objects are JSON-serialized; a non-serializable value (e.g. a circular reference)
 * fails fast with a typed `ParameterCoercionError` carrying the property identifier — never silently
 * degrading to a corrupt `"[object Object]"` parameter.
 */
import { OrmError, ParameterCoercionError } from '@ts-linq/types';

import { coerceParameterValue } from '../src/utils/coerceParameterValue';

describe('coerceParameterValue', () => {
  it('passes primitives through unchanged', () => {
    expect(coerceParameterValue(null)).toBeNull();
    expect(coerceParameterValue('abc')).toBe('abc');
    expect(coerceParameterValue(42)).toBe(42);
    expect(coerceParameterValue(3.14)).toBe(3.14);
    expect(coerceParameterValue(true)).toBe(true);
    expect(coerceParameterValue(false)).toBe(false);
  });

  it('passes Date and Uint8Array through unchanged (by reference)', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    const bytes = new Uint8Array([1, 2, 3]);
    expect(coerceParameterValue(date)).toBe(date);
    expect(coerceParameterValue(bytes)).toBe(bytes);
  });

  it('JSON-serializes a plain object', () => {
    expect(coerceParameterValue({ a: 1 })).toBe('{"a":1}');
  });

  it('JSON-serializes an array', () => {
    expect(coerceParameterValue([1, 2, 3])).toBe('[1,2,3]');
  });

  it('renders bigint as its decimal string (no throw)', () => {
    expect(coerceParameterValue(9007199254740993n)).toBe('9007199254740993');
  });

  it('throws a typed ParameterCoercionError for a non-serializable value', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    try {
      coerceParameterValue(circular, 'payload');
      throw new Error('expected coerceParameterValue to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ParameterCoercionError);
      expect(e).toBeInstanceOf(OrmError);
      const err = e as ParameterCoercionError;
      expect(err.details).toEqual({ property: 'payload' });
      expect(err.cause).toBeInstanceOf(Error);
    }
  });

  it('omits the property from details when not provided', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    try {
      coerceParameterValue(circular);
      throw new Error('expected coerceParameterValue to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ParameterCoercionError);
      const err = e as ParameterCoercionError;
      expect(err.details).toEqual({ property: undefined });
    }
  });
});
