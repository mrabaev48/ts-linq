import type { TableDiff } from '../DiffTypes';
import type { Dialect } from '../Dialect';
export declare class IndexesSqlBuilder {
  private readonly dialect;
  constructor(dialect: Dialect);
  create(td: TableDiff, up: string[]): void;
  drop(td: TableDiff, up: string[]): void;
}
//# sourceMappingURL=IndexesSqlBuilder.d.ts.map
