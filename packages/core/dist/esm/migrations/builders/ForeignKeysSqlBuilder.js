import { handleFkCreates, handleFkDrops } from './MigrationHandlers';
export class ForeignKeysSqlBuilder {
  constructor(dialect) {
    this.dialect = dialect;
  }
  create(td, up) {
    handleFkCreates(td, this.dialect, up);
  }
  drop(td, up) {
    handleFkDrops(td, this.dialect, up);
  }
}
//# sourceMappingURL=ForeignKeysSqlBuilder.js.map
