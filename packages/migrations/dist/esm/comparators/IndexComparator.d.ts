import type { IndexDef, TableSnapshot } from '../DiffTypes';
export declare function isIndexEqual(expIdx: IndexDef, actIdx: IndexDef | undefined): boolean;
export declare function diffIndexes(expectedTable: TableSnapshot, actualTable: TableSnapshot): {
    creates: IndexDef[];
    drops: string[];
};
//# sourceMappingURL=IndexComparator.d.ts.map