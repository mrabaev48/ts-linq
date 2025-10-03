"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFkDrops = handleFkDrops;
exports.buildInlineFkSql = buildInlineFkSql;
exports.buildAddFkSql = buildAddFkSql;
exports.buildDropFkSql = buildDropFkSql;
const SqlUtils_1 = require("../SqlUtils");
function handleFkDrops(td, dialect, up) {
    const fkd = td.fkDrops;
    if (!fkd || fkd.length === 0)
        return;
    for (const nameRaw of fkd)
        up.push(buildDropFkSql(dialect, td.table, nameRaw));
}
function buildInlineFkSql(dialect, fk) {
    const name = fk.name ? `CONSTRAINT ${(0, SqlUtils_1.q)(dialect, fk.name)} ` : '';
    const colsList = fk.columns.map((c) => (0, SqlUtils_1.q)(dialect, c)).join(', ');
    const refCols = fk.refColumns.map((c) => (0, SqlUtils_1.q)(dialect, c)).join(', ');
    const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
    const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
    return `${name}FOREIGN KEY (${colsList}) REFERENCES ${(0, SqlUtils_1.q)(dialect, fk.refTable)} (${refCols})${onDel}${onUpd}`;
}
function buildAddFkSql(dialect, table, fk) {
    switch (dialect) {
        case 'postgresql':
        case 'mysql':
        case 'mssql': {
            const inline = buildInlineFkSql(dialect, fk);
            return `ALTER TABLE ${(0, SqlUtils_1.q)(dialect, table)} ADD ${inline}`;
        }
        default: {
            const name = fk.name ? `CONSTRAINT ${(0, SqlUtils_1.q)(dialect, fk.name)} ` : '';
            const cols = fk.columns.join(', ');
            const refCols = fk.refColumns.join(', ');
            return `-- SQLite requires table rebuild to add FK: ${name}(${cols}) -> ${fk.refTable}(${refCols})`;
        }
    }
}
function buildDropFkSql(dialect, table, nameRaw) {
    switch (dialect) {
        case 'postgresql':
            return `ALTER TABLE ${(0, SqlUtils_1.q)(dialect, table)} DROP CONSTRAINT ${(0, SqlUtils_1.q)(dialect, nameRaw)}`;
        case 'mysql':
            return `ALTER TABLE ${(0, SqlUtils_1.q)(dialect, table)} DROP FOREIGN KEY ${(0, SqlUtils_1.q)(dialect, nameRaw)}`;
        case 'mssql':
            return `ALTER TABLE ${(0, SqlUtils_1.q)(dialect, table)} DROP CONSTRAINT ${(0, SqlUtils_1.q)(dialect, nameRaw)}`;
        default:
            return `-- SQLite requires table rebuild to drop FK: ${nameRaw}`;
    }
}
//# sourceMappingURL=ForeignKeyHandlers.js.map