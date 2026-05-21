import type { HierarchyIdTranslator } from '@ts-linq/types';

export const postgresLtreeFunctions: HierarchyIdTranslator = {
  isDescendantOf: (col, p) => `${col} <@ ${p}::ltree`,
  getLevel: (col) => `nlevel(${col})`,
  getAncestor: (col, p) => `subpath(${col}, 0, nlevel(${col}) - ${p})`
};
