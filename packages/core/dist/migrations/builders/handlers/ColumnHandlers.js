"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleColumnRenames = handleColumnRenames;
exports.renderColumn = renderColumn;
exports.buildAddColumnSql = buildAddColumnSql;
exports.buildDropColumnSql = buildDropColumnSql;
exports.buildAlterTypeSql = buildAlterTypeSql;
exports.buildAlterNullSql = buildAlterNullSql;
const SqlUtils_1 = require("../SqlUtils");
function handleColumnRenames(td, dialect, up) {
    const rns = td
        .columnRenames;
    if (!rns || rns.length === 0)
        return;
    for (const rn of rns) {
        if (!rn.from || !rn.to)
            continue;
        switch (dialect) {
            case 'postgresql':
                up.push(`ALTER TABLE ${(0, SqlUtils_1.q)(dialect, td.table)} RENAME COLUMN ${(0, SqlUtils_1.q)(dialect, rn.from)} TO ${(0, SqlUtils_1.q)(dialect, rn.to)}`);
                break;
            case 'mysql':
                up.push(`-- MySQL requires full type for CHANGE COLUMN ${rn.from} -> ${rn.to}`);
                break;
            case 'mssql':
                up.push(`EXEC sp_rename '${td.table}.${rn.from}', '${rn.to}', 'COLUMN'`);
                break;
            default:
                up.push(`-- SQLite column rename requires pragma or rebuild: ${rn.from} -> ${rn.to}`);
        }
    }
}
function renderColumn(dialect, c) {
    if (c.isComputed &&
        c.computedExpression) {
        switch (dialect) {
            case 'postgresql':
                return `${(0, SqlUtils_1.q)(dialect, c.name)} ${(0, SqlUtils_1.mapType)(dialect, c.type)} GENERATED ALWAYS AS (${c.computedExpression}) STORED`;
            case 'mysql': {
                const kind = c.computedStorage === 'STORED' ? 'STORED' : 'VIRTUAL';
                return `${(0, SqlUtils_1.q)(dialect, c.name)} ${(0, SqlUtils_1.mapType)(dialect, c.type)} GENERATED ALWAYS AS (${c.computedExpression}) ${kind}`;
            }
            case 'mssql': {
                const persisted = c.computedStorage === 'PERSISTED' ? ' PERSISTED' : '';
                return `${(0, SqlUtils_1.q)(dialect, c.name)} AS (${c.computedExpression})${persisted}`;
            }
            default: {
                const kind = c.computedStorage === 'STORED' ? 'STORED' : 'VIRTUAL';
                return `${(0, SqlUtils_1.q)(dialect, c.name)} GENERATED ALWAYS AS (${c.computedExpression}) ${kind}`;
            }
        }
    }
    const dialectMap = c.defaultExpressionDialect || {};
    const defExpr = dialectMap[dialect] || c.defaultExpression;
    const defSql = defExpr
        ? ` DEFAULT ${defExpr}`
        : c.defaultValue !== undefined
            ? ' DEFAULT ' + (0, SqlUtils_1.formatValue)(dialect, c.defaultValue)
            : '';
    return `${(0, SqlUtils_1.q)(dialect, c.name)} ${(0, SqlUtils_1.mapType)(dialect, c.type)}${c.nullable ? '' : ' NOT NULL'}${defSql}`;
}
function buildAddColumnSql(dialect, td, name, type, nullable, def) {
    const table = (0, SqlUtils_1.q)(dialect, td.table);
    const col = (0, SqlUtils_1.q)(dialect, name);
    const typeSql = (0, SqlUtils_1.mapType)(dialect, type);
    const nn = nullable ? '' : ' NOT NULL';
    const d = def !== undefined ? ` DEFAULT ${(0, SqlUtils_1.formatValue)(dialect, def)}` : '';
    const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
    return `ALTER TABLE ${table} ${kw} ${col} ${typeSql}${nn}${d}`;
}
function buildDropColumnSql(dialect, table, name) {
    if (dialect === 'sqlite')
        return `-- DROP COLUMN ${name} is not supported directly in SQLite`;
    return `ALTER TABLE ${(0, SqlUtils_1.q)(dialect, table)} DROP COLUMN ${(0, SqlUtils_1.q)(dialect, name)}`;
}
function buildAlterTypeSql(dialect, table, name, newType) {
    const tableName = (0, SqlUtils_1.q)(dialect, table);
    const columnName = (0, SqlUtils_1.q)(dialect, name);
    const mappedType = (0, SqlUtils_1.mapType)(dialect, newType);
    switch (dialect) {
        case 'postgresql':
            return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${mappedType}`;
        case 'mysql':
            return `ALTER TABLE ${tableName} MODIFY COLUMN ${columnName} ${mappedType}`;
        case 'mssql':
            return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${mappedType}`;
        default:
            return `-- ALTER TYPE not supported for sqlite; requires rebuild`;
    }
}
function buildAlterNullSql(dialect, table, name, nullable) {
    const tableName = (0, SqlUtils_1.q)(dialect, table);
    const columnName = (0, SqlUtils_1.q)(dialect, name);
    switch (dialect) {
        case 'postgresql':
            return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${nullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`;
        case 'mysql':
            return `-- MySQL requires full type in MODIFY for nullability; include in type alter`;
        case 'mssql':
            return `-- MSSQL requires full type in ALTER COLUMN for nullability; include in type alter`;
        default:
            return `-- SQLite nullability alter requires rebuild`;
    }
}
//# sourceMappingURL=ColumnHandlers.js.map