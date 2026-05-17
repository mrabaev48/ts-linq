import type { Dialect } from '../Dialect';
import type { TableDiff } from '../DiffTypes';
import { handleCreateTable, handleDropTable, handleTableRename } from './MigrationHandlers';

export class TablesSqlBuilder {
  constructor(private readonly dialect: Dialect) {}

  rename(td: TableDiff, up: string[]): void {
    handleTableRename(td, this.dialect, up);
  }

  create(td: TableDiff, up: string[], down: string[]): boolean {
    return handleCreateTable(td, this.dialect, up, down);
  }

  drop(td: TableDiff, up: string[]): boolean {
    return handleDropTable(td, this.dialect, up);
  }
}
