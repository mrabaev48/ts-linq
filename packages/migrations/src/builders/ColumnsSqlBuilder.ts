import type { DdlStrategy } from '@ts-linq/types';

import type { Dialect } from '../Dialect';
import type { TableDiff } from '../DiffTypes';
import { handleColumnChanges, handleColumnRenames } from './handlers/ColumnHandlers';

export class ColumnsSqlBuilder {
  constructor(
    private readonly dialect: Dialect,
    private readonly ddl: DdlStrategy
  ) {}

  changes(td: TableDiff, up: string[], down: string[]): void {
    handleColumnChanges(this.ddl, td, this.dialect, up, down);
  }

  renames(td: TableDiff, up: string[]): void {
    handleColumnRenames(td, this.dialect, up);
  }
}
