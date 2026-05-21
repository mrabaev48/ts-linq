import type { HierarchyIdTranslator } from '@ts-linq/types';

export const mssqlHierarchyFunctions: HierarchyIdTranslator = {
  isDescendantOf: (col, p) => `${col}.IsDescendantOf(hierarchyid::Parse(${p})) = 1`,
  getLevel: (col) => `${col}.GetLevel()`,
  getAncestor: (col, p) => `${col}.GetAncestor(${p})`
};
