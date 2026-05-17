import type { Dialect } from '../Dialect';
import type { TableDiff } from '../DiffTypes';
import { handleIndexCreates, handleIndexDrops } from './MigrationHandlers';

export class IndexesSqlBuilder {
  constructor(private readonly dialect: Dialect) {}

  create(td: TableDiff, up: string[]): void {
    handleIndexCreates(td, this.dialect, up);
  }

  drop(td: TableDiff, up: string[]): void {
    handleIndexDrops(td, this.dialect, up);
  }
}
