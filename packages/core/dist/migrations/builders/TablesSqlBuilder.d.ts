import type { TableDiff } from '../DiffTypes';
import type { Dialect } from '../Dialect';
export declare class TablesSqlBuilder {
  private readonly dialect;
  constructor(dialect: Dialect);
  rename(td: TableDiff, up: string[]): void;
  create(td: TableDiff, up: string[], down: string[]): boolean;
  drop(td: TableDiff, up: string[]): boolean;
}
//# sourceMappingURL=TablesSqlBuilder.d.ts.map
