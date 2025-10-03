"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForeignKeysSqlBuilder = void 0;
const MigrationHandlers_1 = require("./MigrationHandlers");
class ForeignKeysSqlBuilder {
    constructor(dialect) {
        this.dialect = dialect;
    }
    create(td, up) {
        (0, MigrationHandlers_1.handleFkCreates)(td, this.dialect, up);
    }
    drop(td, up) {
        (0, MigrationHandlers_1.handleFkDrops)(td, this.dialect, up);
    }
}
exports.ForeignKeysSqlBuilder = ForeignKeysSqlBuilder;
//# sourceMappingURL=ForeignKeysSqlBuilder.js.map