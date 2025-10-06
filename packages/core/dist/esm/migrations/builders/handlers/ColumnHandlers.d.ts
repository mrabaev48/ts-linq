import type { ColumnDef, TableDiff } from '../../DiffTypes';
import type { Dialect } from '../../Dialect';
export declare function handleColumnRenames(td: TableDiff, dialect: Dialect, up: string[]): void;
export declare function renderColumn(dialect: Dialect, c: ColumnDef): string;
export declare function buildAddColumnSql(
  dialect: Dialect,
  td: TableDiff,
  name: string,
  type: string,
  nullable: boolean,
  def?: unknown
): string;
export declare function buildDropColumnSql(dialect: Dialect, table: string, name: string): string;
export declare function buildAlterTypeSql(
  dialect: Dialect,
  table: string,
  name: string,
  newType: string
): string;
export declare function buildAlterNullSql(
  dialect: Dialect,
  table: string,
  name: string,
  nullable: boolean
): string;
//# sourceMappingURL=ColumnHandlers.d.ts.map
