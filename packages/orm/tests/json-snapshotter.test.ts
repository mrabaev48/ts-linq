import { JsonSnapshotter } from '../src/changetracker/JsonSnapshotter';

describe('JsonSnapshotter', () => {
  const snap = new JsonSnapshotter();

  describe('serialize', () => {
    it('serializes null as "null"', () => {
      expect(snap.serialize(null)).toBe('null');
    });

    it('serializes a flat object with sorted keys', () => {
      const result = snap.serialize({ z: 1, a: 2 });
      expect(result).toBe(JSON.stringify({ a: 2, z: 1 }));
    });

    it('serializes nested objects recursively with sorted keys', () => {
      const result = snap.serialize({ z: { b: 1, a: 2 }, a: 0 });
      expect(result).toBe(JSON.stringify({ a: 0, z: { a: 2, b: 1 } }));
    });

    it('serializes arrays as-is', () => {
      const result = snap.serialize({ tags: ['c', 'a', 'b'] });
      expect(result).toBe(JSON.stringify({ tags: ['c', 'a', 'b'] }));
    });
  });

  describe('hasChanged', () => {
    it('returns false when current state matches snapshot', () => {
      const obj = { name: 'dark', count: 3 };
      const original = snap.serialize(obj);
      expect(snap.hasChanged(original, { name: 'dark', count: 3 })).toBe(false);
    });

    it('returns true when a property changes', () => {
      const original = snap.serialize({ name: 'dark' });
      expect(snap.hasChanged(original, { name: 'light' })).toBe(true);
    });

    it('returns true when a property is added', () => {
      const original = snap.serialize({ a: 1 });
      expect(snap.hasChanged(original, { a: 1, b: 2 })).toBe(true);
    });
  });

  describe('toUpdateValue', () => {
    it('produces the same result as serialize', () => {
      const obj = { theme: 'dark', notifications: true };
      expect(snap.toUpdateValue(obj)).toBe(snap.serialize(obj));
    });
  });
});
