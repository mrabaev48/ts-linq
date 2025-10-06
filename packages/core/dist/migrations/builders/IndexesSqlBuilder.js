'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.IndexesSqlBuilder = void 0;
const MigrationHandlers_1 = require('./MigrationHandlers');
class IndexesSqlBuilder {
  constructor(dialect) {
    this.dialect = dialect;
  }
  create(td, up) {
    (0, MigrationHandlers_1.handleIndexCreates)(td, this.dialect, up);
  }
  drop(td, up) {
    (0, MigrationHandlers_1.handleIndexDrops)(td, this.dialect, up);
  }
}
exports.IndexesSqlBuilder = IndexesSqlBuilder;
//# sourceMappingURL=IndexesSqlBuilder.js.map
