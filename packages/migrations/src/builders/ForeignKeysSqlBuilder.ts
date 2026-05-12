import type { TableDiff } from '../DiffTypes';
import type { Dialect } from '../Dialect';
import { handleFkCreates, handleFkDrops } from './MigrationHandlers';

export class ForeignKeysSqlBuilder {
  constructor(private readonly dialect: Dialect) {}

  create(td: TableDiff, up: string[]): void {
    handleFkCreates(td, this.dialect, up);
  }

  drop(td: TableDiff, up: string[]): void {
    handleFkDrops(td, this.dialect, up);
  }
}
