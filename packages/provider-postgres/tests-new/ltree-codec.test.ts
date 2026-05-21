import { HierarchyId } from '@ts-linq/core';

import { decodeLtree, encodeLtree, isHierarchyId } from '../src/ltree-codec';

describe('Postgres ltree-codec', () => {
  describe('isHierarchyId', () => {
    it('returns true for HierarchyId instance', () => {
      expect(isHierarchyId(HierarchyId.getRoot())).toBe(true);
      expect(isHierarchyId(HierarchyId.parse('/1/2/'))).toBe(true);
    });

    it('returns false for non-HierarchyId', () => {
      expect(isHierarchyId('1.2')).toBe(false);
      expect(isHierarchyId(null)).toBe(false);
    });
  });

  describe('encodeLtree', () => {
    it('encodes root to empty string', () => {
      expect(encodeLtree(HierarchyId.getRoot())).toBe('');
    });

    it('encodes /1/ to "1"', () => {
      expect(encodeLtree(HierarchyId.parse('/1/'))).toBe('1');
    });

    it('encodes /1/2/3/ to "1.2.3"', () => {
      expect(encodeLtree(HierarchyId.parse('/1/2/3/'))).toBe('1.2.3');
    });

    it('encodes /10/20/ to "10.20"', () => {
      expect(encodeLtree(HierarchyId.parse('/10/20/'))).toBe('10.20');
    });
  });

  describe('decodeLtree', () => {
    it('decodes empty string to root', () => {
      const h = decodeLtree('');
      expect(h.getLevel()).toBe(0);
      expect(h.toString()).toBe('/');
    });

    it('decodes "1" to /1/', () => {
      const h = decodeLtree('1');
      expect(h.toString()).toBe('/1/');
    });

    it('decodes "1.2.3" to /1/2/3/', () => {
      const h = decodeLtree('1.2.3');
      expect(h.toString()).toBe('/1/2/3/');
    });

    it('decodes "10.20" to /10/20/', () => {
      const h = decodeLtree('10.20');
      expect(h.toString()).toBe('/10/20/');
    });

    it('throws for non-numeric ltree segments', () => {
      expect(() => decodeLtree('foo.bar')).toThrow(RangeError);
    });
  });

  describe('round-trip', () => {
    const cases: Array<[string, string]> = [
      ['/1/', '1'],
      ['/1/2/', '1.2'],
      ['/1/2/3/', '1.2.3'],
      ['/10/20/30/', '10.20.30']
    ];
    for (const [mssql, ltree] of cases) {
      it(`round-trips ${mssql} ↔ ${ltree}`, () => {
        const original = HierarchyId.parse(mssql);
        const encoded = encodeLtree(original);
        expect(encoded).toBe(ltree);
        const decoded = decodeLtree(encoded);
        expect(decoded.toString()).toBe(mssql);
      });
    }
  });
});
