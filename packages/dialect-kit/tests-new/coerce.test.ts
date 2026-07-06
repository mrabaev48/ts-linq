import { applyConverter, coerceSqlParameter } from '@ts-linq/dialect-kit';
import { type ColumnMetadata, OrmError, ParameterCoercionError } from '@ts-linq/types';

describe('coerceSqlParameter', () => {
  it('passes null through unchanged', () => {
    expect(coerceSqlParameter(null)).toBeNull();
  });

  it('passes primitives through unchanged', () => {
    expect(coerceSqlParameter('hello')).toBe('hello');
    expect(coerceSqlParameter(42)).toBe(42);
    expect(coerceSqlParameter(true)).toBe(true);
    expect(coerceSqlParameter(false)).toBe(false);
  });

  it('passes Date and Uint8Array through unchanged (same reference)', () => {
    const date = new Date('2023-01-01T00:00:00.000Z');
    const bytes = new Uint8Array([1, 2, 3]);
    expect(coerceSqlParameter(date)).toBe(date);
    expect(coerceSqlParameter(bytes)).toBe(bytes);
  });

  it('JSON-serializes plain objects and arrays', () => {
    expect(coerceSqlParameter({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
    expect(coerceSqlParameter([1, 2, 3])).toBe('[1,2,3]');
  });

  it('serializes undefined to the JSON null literal', () => {
    // JSON.stringify(undefined ?? null) === 'null'
    expect(coerceSqlParameter(undefined)).toBe('null');
  });

  it('renders bigint as its decimal string (no throw)', () => {
    expect(coerceSqlParameter(1n)).toBe('1');
    expect(coerceSqlParameter(9007199254740993n)).toBe('9007199254740993');
  });

  it('throws a typed ParameterCoercionError for a non-serializable (circular) value', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => coerceSqlParameter(circular, 'payload')).toThrow(ParameterCoercionError);

    try {
      coerceSqlParameter(circular, 'payload');
      throw new Error('expected coerceSqlParameter to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ParameterCoercionError);
      expect(e).toBeInstanceOf(OrmError);
      const err = e as ParameterCoercionError;
      // identifier context is surfaced for diagnosis…
      expect(err.details).toEqual({ property: 'payload' });
      expect(err.message).toContain('payload');
      // …and the original serialization failure is preserved as `cause`.
      expect(err.cause).toBeInstanceOf(Error);
    }
  });
});

describe('applyConverter', () => {
  const baseCol: ColumnMetadata = { propertyName: 'p', columnName: 'c', type: 'TEXT' };

  it('returns the value unchanged when the column has no converter', () => {
    expect(applyConverter('raw', baseCol)).toBe('raw');
  });

  it('applies converter.toProvider when present', () => {
    const col: ColumnMetadata = {
      ...baseCol,
      converter: { toProvider: (v: unknown) => `provider:${String(v)}`, fromProvider: (v) => v }
    };
    expect(applyConverter('x', col)).toBe('provider:x');
  });
});
