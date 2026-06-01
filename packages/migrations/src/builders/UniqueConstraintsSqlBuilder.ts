import type { Dialect } from '../Dialect';
import type { TableDiff } from '../DiffTypes';
import { handleUniqueConstraintCreates, handleUniqueConstraintDrops } from './MigrationHandlers';

export class UniqueConstraintsSqlBuilder {
  constructor(private readonly dialect: Dialect) {}

  create(td: TableDiff, up: string[]): void {
    handleUniqueConstraintCreates(td, this.dialect, up);
  }

  drop(td: TableDiff, up: string[]): void {
    handleUniqueConstraintDrops(td, this.dialect, up);
  }
}
