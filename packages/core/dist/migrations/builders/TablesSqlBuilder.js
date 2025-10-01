"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TablesSqlBuilder = void 0;
const MigrationHandlers_1 = require("./MigrationHandlers");
class TablesSqlBuilder {
    constructor(dialect) {
        this.dialect = dialect;
    }
    rename(td, up) {
        (0, MigrationHandlers_1.handleTableRename)(td, this.dialect, up);
    }
    create(td, up, down) {
        return (0, MigrationHandlers_1.handleCreateTable)(td, this.dialect, up, down);
    }
    drop(td, up) {
        return (0, MigrationHandlers_1.handleDropTable)(td, this.dialect, up);
    }
}
exports.TablesSqlBuilder = TablesSqlBuilder;
//# sourceMappingURL=TablesSqlBuilder.js.map