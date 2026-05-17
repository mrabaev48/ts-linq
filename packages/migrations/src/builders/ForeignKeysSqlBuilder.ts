import type { Dialect } from '../Dialect';
import type { TableDiff } from '../DiffTypes';
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
