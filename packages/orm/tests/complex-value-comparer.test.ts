import { complexDeepEquals, complexSnapshot } from '../src/changetracker/complexValueComparer';

describe('complexDeepEquals', () => {
  it('returns true for identical primitives', () => {
    expect(complexDeepEquals(1, 1)).toBe(true);
    expect(complexDeepEquals('a', 'a')).toBe(true);
    expect(complexDeepEquals(null, null)).toBe(true);
    expect(complexDeepEquals(undefined, undefined)).toBe(true);
  });

  it('returns false for different primitives', () => {
    expect(complexDeepEquals(1, 2)).toBe(false);
    expect(complexDeepEquals('a', 'b')).toBe(false);
    expect(complexDeepEquals(null, undefined)).toBe(false);
  });

  it('compares plain objects by value', () => {
    expect(complexDeepEquals({ street: 'A', city: 'B' }, { street: 'A', city: 'B' })).toBe(true);
    expect(complexDeepEquals({ street: 'A', city: 'B' }, { street: 'X', city: 'B' })).toBe(false);
  });

  it('returns false for objects with different key counts', () => {
    expect(complexDeepEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('compares nested objects recursively', () => {
    expect(
      complexDeepEquals({ coords: { lat: 1.0, lng: 2.0 } }, { coords: { lat: 1.0, lng: 2.0 } })
    ).toBe(true);
    expect(
      complexDeepEquals({ coords: { lat: 1.0, lng: 2.0 } }, { coords: { lat: 1.0, lng: 3.0 } })
    ).toBe(false);
  });

  it('compares arrays element-by-element', () => {
    expect(complexDeepEquals([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(complexDeepEquals([1, 2], [1, 2, 3])).toBe(false);
    expect(complexDeepEquals([1, 3], [1, 2])).toBe(false);
  });

  it('compares Date objects by time value', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-01');
    const d3 = new Date('2024-06-01');
    expect(complexDeepEquals(d1, d2)).toBe(true);
    expect(complexDeepEquals(d1, d3)).toBe(false);
  });
});

describe('complexSnapshot', () => {
  it('returns null/undefined as-is', () => {
    expect(complexSnapshot(null)).toBeNull();
    expect(complexSnapshot(undefined)).toBeUndefined();
  });

  it('deep-clones plain objects', () => {
    const original = { street: 'Main St', city: 'Springfield' };
    const snap = complexSnapshot(original);
    expect(snap).toEqual(original);
    expect(snap).not.toBe(original);
  });

  it('deep-clones nested objects', () => {
    const original = { coords: { lat: 10, lng: 20 } };
    const snap = complexSnapshot(original);
    expect(snap).toEqual(original);
    expect(snap.coords).not.toBe(original.coords);
  });

  it('mutations to snapshot do not affect original', () => {
    const original = { street: 'Main St' };
    const snap = complexSnapshot(original) as typeof original;
    snap.street = 'Changed';
    expect(original.street).toBe('Main St');
  });
});
