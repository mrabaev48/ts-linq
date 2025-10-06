import { handleColumnChanges, handleColumnRenames } from './MigrationHandlers';
export class ColumnsSqlBuilder {
  constructor(dialect) {
    this.dialect = dialect;
  }
  changes(td, up, down) {
    handleColumnChanges(td, this.dialect, up, down);
  }
  renames(td, up) {
    handleColumnRenames(td, this.dialect, up);
  }
}
//# sourceMappingURL=ColumnsSqlBuilder.js.map
