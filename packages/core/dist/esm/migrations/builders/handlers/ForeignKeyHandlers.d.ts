import type { TableDiff } from '../../DiffTypes';
import type { Dialect } from '../../Dialect';
export declare function handleFkDrops(td: TableDiff, dialect: Dialect, up: string[]): void;
export declare function buildInlineFkSql(dialect: Dialect, fk: {
    name?: string;
    columns: string[];
    refTable: string;
    refColumns: string[];
    onDelete?: string;
    onUpdate?: string;
}): string;
export declare function buildAddFkSql(dialect: Dialect, table: string, fk: {
    name?: string;
    columns: string[];
    refTable: string;
    refColumns: string[];
    onDelete?: string;
    onUpdate?: string;
}): string;
export declare function buildDropFkSql(dialect: Dialect, table: string, nameRaw: string): string;
//# sourceMappingURL=ForeignKeyHandlers.d.ts.map