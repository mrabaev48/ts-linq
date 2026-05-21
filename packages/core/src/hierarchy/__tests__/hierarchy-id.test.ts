import { HierarchyId } from '../hierarchy-id';

describe('HierarchyId', () => {
  describe('parse', () => {
    it('parses root "/"', () => {
      const h = HierarchyId.parse('/');
      expect(h.getLevel()).toBe(0);
      expect(h.toString()).toBe('/');
    });

    it('parses "/1/"', () => {
      const h = HierarchyId.parse('/1/');
      expect(h.getLevel()).toBe(1);
      expect(h.toString()).toBe('/1/');
    });

    it('parses "/1/2/3/"', () => {
      const h = HierarchyId.parse('/1/2/3/');
      expect(h.getLevel()).toBe(3);
      expect(h.toString()).toBe('/1/2/3/');
    });

    it('throws on invalid segment', () => {
      expect(() => HierarchyId.parse('/1/abc/')).toThrow(RangeError);
    });
  });

  describe('getRoot', () => {
    it('returns root node', () => {
      const root = HierarchyId.getRoot();
      expect(root.getLevel()).toBe(0);
      expect(root.toString()).toBe('/');
    });
  });

  describe('isHierarchyId', () => {
    it('returns true for HierarchyId', () => {
      expect(HierarchyId.isHierarchyId(HierarchyId.getRoot())).toBe(true);
    });

    it('returns false for other values', () => {
      expect(HierarchyId.isHierarchyId(null)).toBe(false);
      expect(HierarchyId.isHierarchyId('/1/')).toBe(false);
      expect(HierarchyId.isHierarchyId({})).toBe(false);
    });
  });

  describe('getLevel', () => {
    it('root level is 0', () => {
      expect(HierarchyId.getRoot().getLevel()).toBe(0);
    });

    it('level matches depth', () => {
      expect(HierarchyId.parse('/1/').getLevel()).toBe(1);
      expect(HierarchyId.parse('/1/2/').getLevel()).toBe(2);
      expect(HierarchyId.parse('/1/2/3/').getLevel()).toBe(3);
    });
  });

  describe('getAncestor', () => {
    it('n=0 returns self', () => {
      const h = HierarchyId.parse('/1/2/3/');
      expect(h.getAncestor(0).toString()).toBe('/1/2/3/');
    });

    it('n=1 returns parent', () => {
      expect(HierarchyId.parse('/1/2/3/').getAncestor(1).toString()).toBe('/1/2/');
    });

    it('n=level returns root', () => {
      const h = HierarchyId.parse('/1/2/3/');
      expect(h.getAncestor(3).toString()).toBe('/');
    });

    it('throws for n > level', () => {
      expect(() => HierarchyId.parse('/1/').getAncestor(5)).toThrow(RangeError);
    });

    it('throws for negative n', () => {
      expect(() => HierarchyId.parse('/1/').getAncestor(-1)).toThrow(RangeError);
    });
  });

  describe('isDescendantOf', () => {
    const root = HierarchyId.getRoot();
    const n1 = HierarchyId.parse('/1/');
    const n12 = HierarchyId.parse('/1/2/');
    const n123 = HierarchyId.parse('/1/2/3/');
    const n2 = HierarchyId.parse('/2/');

    it('every node is descendant of root', () => {
      expect(n1.isDescendantOf(root)).toBe(true);
      expect(n12.isDescendantOf(root)).toBe(true);
      expect(n123.isDescendantOf(root)).toBe(true);
    });

    it('root is descendant of root (self)', () => {
      expect(root.isDescendantOf(root)).toBe(true);
    });

    it('deep node is descendant of ancestor', () => {
      expect(n123.isDescendantOf(n1)).toBe(true);
      expect(n123.isDescendantOf(n12)).toBe(true);
    });

    it('is NOT descendant of sibling branch', () => {
      expect(n12.isDescendantOf(n2)).toBe(false);
      expect(n123.isDescendantOf(n2)).toBe(false);
    });

    it('parent is NOT descendant of child', () => {
      expect(n1.isDescendantOf(n12)).toBe(false);
    });

    it('self is descendant of self', () => {
      expect(n12.isDescendantOf(n12)).toBe(true);
    });
  });

  describe('getDescendant', () => {
    it('no args returns first child', () => {
      const root = HierarchyId.getRoot();
      const child = root.getDescendant();
      expect(child.toString()).toBe('/1/');
    });

    it('after child1 returns next sibling', () => {
      const root = HierarchyId.getRoot();
      const c1 = HierarchyId.parse('/1/');
      const child = root.getDescendant(c1);
      expect(child.toString()).toBe('/2/');
    });

    it('is descendant of parent', () => {
      const parent = HierarchyId.parse('/1/');
      const child = parent.getDescendant();
      expect(child.isDescendantOf(parent)).toBe(true);
    });

    it('throws when child1 >= child2', () => {
      const root = HierarchyId.getRoot();
      const c1 = HierarchyId.parse('/2/');
      const c2 = HierarchyId.parse('/2/');
      expect(() => root.getDescendant(c1, c2)).toThrow(RangeError);
    });
  });

  describe('toString / toLtreeString / toMssqlString', () => {
    it('root toString = "/"', () => {
      expect(HierarchyId.getRoot().toString()).toBe('/');
    });

    it('root toLtreeString = ""', () => {
      expect(HierarchyId.getRoot().toLtreeString()).toBe('');
    });

    it('/1/2/3/ toLtreeString = "1.2.3"', () => {
      expect(HierarchyId.parse('/1/2/3/').toLtreeString()).toBe('1.2.3');
    });

    it('toMssqlString equals toString', () => {
      const h = HierarchyId.parse('/1/2/');
      expect(h.toMssqlString()).toBe(h.toString());
    });
  });

  describe('round-trip', () => {
    const cases = ['/', '/1/', '/1/2/', '/1/2/3/', '/10/20/30/'];
    for (const path of cases) {
      it(`round-trips ${path}`, () => {
        expect(HierarchyId.parse(path).toString()).toBe(path);
      });
    }
  });
});
