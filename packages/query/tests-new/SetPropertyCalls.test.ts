/**
 * Coercion behavior of the `setProperty(...)` literal path.
 *
 * A literal value assigned via `setProperty` is coerced to a driver-safe `SqlParameter`. A
 * non-serializable value (e.g. a circular reference) must fail fast with a typed
 * `ParameterCoercionError` carrying the property identifier — never silently degrade to a corrupt
 * `"[object Object]"` parameter. Primitives / plain objects / bigint keep their prior behavior.
 */
import { OrmError, ParameterCoercionError } from '@ts-linq/types';

import { SetPropertyCalls } from '../src/SetPropertyCalls';

interface Row {
  payload: unknown;
}

describe('SetPropertyCalls literal coercion', () => {
  it('JSON-serializes a plain object (happy path unchanged)', () => {
    const calls = new SetPropertyCalls<Row>();
    calls.setProperty((e) => e.payload, { a: 1 });
    const [entry] = calls.getSetters();
    expect(entry.value).toEqual({ kind: 'literal', params: ['{"a":1}'] });
  });

  it('renders bigint as its decimal string (no throw)', () => {
    const calls = new SetPropertyCalls<Row>();
    calls.setProperty((e) => e.payload, 9007199254740993n);
    const [entry] = calls.getSetters();
    expect(entry.value).toEqual({ kind: 'literal', params: ['9007199254740993'] });
  });

  it('throws a typed ParameterCoercionError for a non-serializable value', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const calls = new SetPropertyCalls<Row>();

    try {
      calls.setProperty((e) => e.payload, circular);
      throw new Error('expected setProperty to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ParameterCoercionError);
      expect(e).toBeInstanceOf(OrmError);
      const err = e as ParameterCoercionError;
      expect(err.details).toEqual({ property: 'payload' });
      expect(err.cause).toBeInstanceOf(Error);
    }
  });
});
