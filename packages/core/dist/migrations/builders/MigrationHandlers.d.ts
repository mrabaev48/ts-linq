import type { TableDiff, ColumnDef } from '../DiffTypes';
import type { Dialect } from '../Dialect';
export {
  renderColumn,
  buildAddColumnSql,
  buildDropColumnSql,
  buildAlterTypeSql,
  buildAlterNullSql
} from './handlers/ColumnHandlers';
export { buildInlineFkSql, buildAddFkSql, buildDropFkSql } from './handlers/ForeignKeyHandlers';
export {
  handleTableRename,
  handleCreateTable,
  handleDropTable,
  buildCreateTableSql
} from './handlers/TableHandlers';
export declare function handleIndexCreates(td: TableDiff, dialect: Dialect, up: string[]): void;
export declare function buildIndexColumnsList(
  dialect: Dialect,
  columns: string[],
  orders?: {
    [column: string]: 'ASC' | 'DESC';
  },
  collations?: {
    [column: string]: string;
  },
  nulls?: {
    [column: string]: 'FIRST' | 'LAST';
  },
  expressions?: string[]
): string;
export { handleIndexDrops } from './handlers/IndexHandlers';
export declare function handleFkCreates(td: TableDiff, dialect: Dialect, up: string[]): void;
export { handleFkDrops } from './handlers/ForeignKeyHandlers';
export declare function handleColumnChanges(
  td: TableDiff,
  dialect: Dialect,
  up: string[],
  down: string[]
): void;
export declare function buildCreateIndexSql(
  dialect: Dialect,
  table: string,
  idx: {
    name: string;
    columns: string[];
    unique?: boolean;
    where?: string;
    orders?: {
      [column: string]: 'ASC' | 'DESC';
    };
    collations?: {
      [column: string]: string;
    };
    nulls?: {
      [column: string]: 'FIRST' | 'LAST';
    };
    expressions?: string[];
    using?: 'btree' | 'hash' | 'gin' | 'gist';
    concurrently?: boolean;
    withParams?: Record<string, string | number | boolean>;
    mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
    include?: string[];
  }
): string;
export declare function buildIndexWhere(dialect: Dialect, where?: string): string;
export declare function buildIndexUsing(
  dialect: Dialect,
  using?: 'btree' | 'hash' | 'gin' | 'gist'
): string;
export declare function buildIndexConcurrently(dialect: Dialect, concurrently?: boolean): string;
export declare function buildIndexWithParams(
  dialect: Dialect,
  withParams?: Record<string, string | number | boolean>
): string;
export declare function buildIndexVisibility(
  dialect: Dialect,
  visibility?: 'VISIBLE' | 'INVISIBLE'
): string;
export declare function buildIndexInclude(dialect: Dialect, include?: string[]): string;
export declare function handleAddColumnChange(
  dialect: Dialect,
  td: TableDiff,
  ch: {
    kind: 'add';
    column: ColumnDef;
  },
  up: string[],
  down: string[]
): void;
export declare function handleAlterColumnChange(
  dialect: Dialect,
  td: TableDiff,
  ch: {
    kind: 'alter';
    column: ColumnDef;
    prev?: ColumnDef;
  },
  up: string[]
): void;
export declare function handleDropColumnChange(
  dialect: Dialect,
  td: TableDiff,
  ch: {
    kind: 'drop';
    column: ColumnDef;
  },
  up: string[]
): void;
export declare function isComputedColumn(c: ColumnDef): boolean;
export declare function hasDefaultExpression(c: ColumnDef): boolean;
export declare function isComputedChanged(prev: ColumnDef | undefined, curr: ColumnDef): boolean;
export declare function hasTypeChanged(prev: ColumnDef | undefined, curr: ColumnDef): boolean;
export { handleColumnRenames } from './handlers/ColumnHandlers';
//# sourceMappingURL=MigrationHandlers.d.ts.map
