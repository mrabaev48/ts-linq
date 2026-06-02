// Транслятор-интерфейсы для spatial и hierarchyid (P2-34, P2-35)

/**
 * HierarchyId translator interface for dialect-specific SQL function mapping.
 * Implementations live in each @ts-linq/dialect-* package.
 * Used by HierarchyMethodVisitor in @ts-linq/sql-visitor.
 */
export interface HierarchyIdTranslator {
  isDescendantOf(col: string, param: string): string;
  getLevel(col: string): string;
  getAncestor(col: string, param: string): string;
}

/**
 * Spatial translator interface for dialect-specific SQL spatial function mapping.
 * Implementations live in each @ts-linq/dialect-* package.
 * Used by SpatialMethodVisitor in @ts-linq/sql-visitor.
 */
export interface SpatialTranslator {
  distance(col: string, param: string): string;
  intersects(col: string, param: string): string;
  within(col: string, param: string): string;
  buffer(col: string, param: string): string;
  area(col: string): string;
  length(col: string): string;
  contains(col: string, param: string): string;
}
