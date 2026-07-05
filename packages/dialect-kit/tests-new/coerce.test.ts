import { applyConverter, coerceSqlParameter } from '@ts-linq/dialect-kit';
import type { ColumnMetadata } from '@ts-linq/types';

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

  it('falls back to String(value) for a non-serializable (circular) value', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(coerceSqlParameter(circular)).toBe('[object Object]');
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
