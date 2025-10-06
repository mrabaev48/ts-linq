import { handleCreateTable, handleDropTable, handleTableRename } from './MigrationHandlers';
export class TablesSqlBuilder {
  constructor(dialect) {
    this.dialect = dialect;
  }
  rename(td, up) {
    handleTableRename(td, this.dialect, up);
  }
  create(td, up, down) {
    return handleCreateTable(td, this.dialect, up, down);
  }
  drop(td, up) {
    return handleDropTable(td, this.dialect, up);
  }
}
//# sourceMappingURL=TablesSqlBuilder.js.map
