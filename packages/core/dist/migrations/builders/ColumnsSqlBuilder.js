'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ColumnsSqlBuilder = void 0;
const MigrationHandlers_1 = require('./MigrationHandlers');
class ColumnsSqlBuilder {
  constructor(dialect) {
    this.dialect = dialect;
  }
  changes(td, up, down) {
    (0, MigrationHandlers_1.handleColumnChanges)(td, this.dialect, up, down);
  }
  renames(td, up) {
    (0, MigrationHandlers_1.handleColumnRenames)(td, this.dialect, up);
  }
}
exports.ColumnsSqlBuilder = ColumnsSqlBuilder;
//# sourceMappingURL=ColumnsSqlBuilder.js.map
