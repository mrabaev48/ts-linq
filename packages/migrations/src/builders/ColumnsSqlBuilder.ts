import type { Dialect } from '../Dialect';
import type { TableDiff } from '../DiffTypes';
import { handleColumnChanges, handleColumnRenames } from './handlers/ColumnHandlers';

export class ColumnsSqlBuilder {
  constructor(private readonly dialect: Dialect) {}

  changes(td: TableDiff, up: string[], down: string[]): void {
    handleColumnChanges(td, this.dialect, up, down);
  }

  renames(td: TableDiff, up: string[]): void {
    handleColumnRenames(td, this.dialect, up);
  }
}
