import type { TableDiff } from '../../DiffTypes';
import type { Dialect } from '../../Dialect';
export declare function handleTableRename(td: TableDiff, dialect: Dialect, up: string[]): void;
export declare function handleCreateTable(td: TableDiff, dialect: Dialect, up: string[], down: string[]): boolean;
export declare function handleDropTable(td: TableDiff, dialect: Dialect, up: string[]): boolean;
export declare function buildCreateTableSql(td: TableDiff, dialect: Dialect): string;
//# sourceMappingURL=TableHandlers.d.ts.map