import type { ColumnDef, ColumnChange, TableSnapshot } from '../DiffTypes';
export declare function normalizeType(typeName: string): string;
export declare function isColumnAltered(
  expectedColumn: ColumnDef,
  actualColumn: ColumnDef
): boolean;
export declare function diffColumns(
  expectedTable: TableSnapshot,
  actualTable: TableSnapshot
): ColumnChange[];
//# sourceMappingURL=ColumnComparator.d.ts.map
