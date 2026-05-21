import { HierarchyId } from '@ts-linq/core';

import { decodeHierarchyId, encodeHierarchyId, isHierarchyId } from '../src/hierarchy-codec';

describe('MSSQL hierarchy-codec', () => {
  describe('isHierarchyId', () => {
    it('returns true for HierarchyId instance', () => {
      expect(isHierarchyId(HierarchyId.getRoot())).toBe(true);
      expect(isHierarchyId(HierarchyId.parse('/1/2/'))).toBe(true);
    });

    it('returns false for non-HierarchyId', () => {
      expect(isHierarchyId('/1/2/')).toBe(false);
      expect(isHierarchyId(null)).toBe(false);
      expect(isHierarchyId({})).toBe(false);
    });
  });

  describe('encodeHierarchyId', () => {
    it('encodes root to "/"', () => {
      expect(encodeHierarchyId(HierarchyId.getRoot())).toBe('/');
    });

    it('encodes /1/ to "/1/"', () => {
      expect(encodeHierarchyId(HierarchyId.parse('/1/'))).toBe('/1/');
    });

    it('encodes /1/2/3/ correctly', () => {
      expect(encodeHierarchyId(HierarchyId.parse('/1/2/3/'))).toBe('/1/2/3/');
    });
  });

  describe('decodeHierarchyId', () => {
    it('decodes string "/1/2/"', () => {
      const h = decodeHierarchyId('/1/2/');
      expect(h.getLevel()).toBe(2);
      expect(h.toString()).toBe('/1/2/');
    });

    it('decodes root "/" string', () => {
      const h = decodeHierarchyId('/');
      expect(h.getLevel()).toBe(0);
      expect(h.toString()).toBe('/');
    });

    it('decodes Buffer containing UTF-8 hierarchyid string', () => {
      const buf = Buffer.from('/1/2/3/', 'utf8');
      const h = decodeHierarchyId(buf);
      expect(h.toString()).toBe('/1/2/3/');
    });
  });

  describe('round-trip', () => {
    const paths = ['/', '/1/', '/1/2/', '/1/2/3/', '/10/20/30/'];
    for (const path of paths) {
      it(`round-trips ${path}`, () => {
        const original = HierarchyId.parse(path);
        const encoded = encodeHierarchyId(original);
        const decoded = decodeHierarchyId(encoded);
        expect(decoded.toString()).toBe(path);
      });
    }
  });
});
