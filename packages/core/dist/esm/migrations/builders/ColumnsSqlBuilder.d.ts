import type { TableDiff } from '../DiffTypes';
import type { Dialect } from '../Dialect';
export declare class ColumnsSqlBuilder {
    private readonly dialect;
    constructor(dialect: Dialect);
    changes(td: TableDiff, up: string[], down: string[]): void;
    renames(td: TableDiff, up: string[]): void;
}
//# sourceMappingURL=ColumnsSqlBuilder.d.ts.map