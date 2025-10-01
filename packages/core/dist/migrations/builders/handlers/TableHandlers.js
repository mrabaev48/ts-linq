"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTableRename = handleTableRename;
exports.handleCreateTable = handleCreateTable;
exports.handleDropTable = handleDropTable;
exports.buildCreateTableSql = buildCreateTableSql;
const SqlUtils_1 = require("../SqlUtils");
const ColumnHandlers_1 = require("./ColumnHandlers");
const ForeignKeyHandlers_1 = require("./ForeignKeyHandlers");
function handleTableRename(td, dialect, up) {
    if (td.renameTo) {
        const to = td.renameTo;
        switch (dialect) {
            case 'postgresql':
                up.push(`ALTER TABLE ${(0, SqlUtils_1.q)(dialect, td.table)} RENAME TO ${(0, SqlUtils_1.q)(dialect, to)}`);
                break;
            case 'mysql':
                up.push(`RENAME TABLE ${(0, SqlUtils_1.q)(dialect, td.table)} TO ${(0, SqlUtils_1.q)(dialect, to)}`);
                break;
            case 'mssql':
                up.push(`EXEC sp_rename '${td.table}', '${to}'`);
                break;
            default:
                up.push(`ALTER TABLE ${(0, SqlUtils_1.q)(dialect, td.table)} RENAME TO ${(0, SqlUtils_1.q)(dialect, to)}`);
        }
    }
}
function handleCreateTable(td, dialect, up, down) {
    if (!td.create)
        return false;
    up.push(buildCreateTableSql(td, dialect));
    if (td.create.indexes && td.create.indexes.length > 0) {
        for (const idx of td.create.indexes) {
            const uniq = idx.unique ? 'UNIQUE ' : '';
            const cols = idx.columns.map((column) => (0, SqlUtils_1.q)(dialect, column)).join(', ');
            const name = (0, SqlUtils_1.q)(dialect, idx.name);
            const where = idx.where && dialect !== 'mysql' ? ` WHERE ${idx.where}` : '';
            up.push(`CREATE ${uniq}INDEX ${name} ON ${(0, SqlUtils_1.q)(dialect, td.create.name)} (${cols})${where}`);
        }
    }
    down.push(`DROP TABLE ${(0, SqlUtils_1.q)(dialect, td.create.name)}`);
    return true;
}
function handleDropTable(td, dialect, up) {
    if (!td.drop)
        return false;
    up.push(`DROP TABLE ${(0, SqlUtils_1.q)(dialect, td.table)}`);
    return true;
}
function buildCreateTableSql(td, dialect) {
    const create = td.create;
    const cols = create.columns.map((c) => (0, ColumnHandlers_1.renderColumn)(dialect, c));
    if (create.primaryKeys && create.primaryKeys.length > 0)
        cols.push(`PRIMARY KEY (${create.primaryKeys.map((pk) => (0, SqlUtils_1.q)(dialect, pk)).join(', ')})`);
    if (create.foreignKeys && create.foreignKeys.length > 0) {
        for (const fk of create.foreignKeys)
            cols.push((0, ForeignKeyHandlers_1.buildInlineFkSql)(dialect, fk));
    }
    return `CREATE TABLE IF NOT EXISTS ${(0, SqlUtils_1.q)(dialect, create.name)} (${cols.join(', ')})`;
}
//# sourceMappingURL=TableHandlers.js.map