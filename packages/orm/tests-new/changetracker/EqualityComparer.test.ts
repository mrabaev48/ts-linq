import { describe, expect, it } from '@jest/globals';

import {
  DeepEqualityComparer,
  defaultEqualityComparer
} from '../../src/changetracker/EqualityComparer';

describe('DeepEqualityComparer', () => {
  const cmp = new DeepEqualityComparer();

  it('compares primitives by value', () => {
    expect(cmp.equals(1, 1)).toBe(true);
    expect(cmp.equals('a', 'a')).toBe(true);
    expect(cmp.equals(1, 2)).toBe(false);
    expect(cmp.equals('a', 'b')).toBe(false);
  });

  it('treats null and undefined as equal only to themselves', () => {
    expect(cmp.equals(null, null)).toBe(true);
    expect(cmp.equals(undefined, undefined)).toBe(true);
    expect(cmp.equals(null, undefined)).toBe(false);
    expect(cmp.equals(null, 0)).toBe(false);
    expect(cmp.equals(undefined, {})).toBe(false);
  });

  it('compares Date values by time, not reference', () => {
    expect(cmp.equals(new Date('2020-01-01'), new Date('2020-01-01'))).toBe(true);
    expect(cmp.equals(new Date('2020-01-01'), new Date('2021-01-01'))).toBe(false);
  });

  it('compares arrays element-by-element', () => {
    expect(cmp.equals([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(cmp.equals([1, 2], [1, 2, 3])).toBe(false);
    expect(cmp.equals([1, 3], [1, 2])).toBe(false);
  });

  it('is key-order insensitive for plain objects', () => {
    expect(cmp.equals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(cmp.equals({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
  });

  it('detects differing key sets / counts', () => {
    expect(cmp.equals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(cmp.equals({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('recurses into nested structures', () => {
    expect(cmp.equals({ p: { lat: 1, lng: 2 } }, { p: { lng: 2, lat: 1 } })).toBe(true);
    expect(cmp.equals({ p: { lat: 1, lng: 2 } }, { p: { lat: 1, lng: 9 } })).toBe(false);
  });

  it('exposes a shared default singleton instance', () => {
    expect(defaultEqualityComparer.equals({ x: 1 }, { x: 1 })).toBe(true);
  });
});
