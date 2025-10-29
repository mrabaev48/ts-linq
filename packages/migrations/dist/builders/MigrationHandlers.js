"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleColumnRenames = exports.handleFkDrops = exports.handleIndexDrops = exports.buildCreateTableSql = exports.handleDropTable = exports.handleCreateTable = exports.handleTableRename = exports.buildDropFkSql = exports.buildAddFkSql = exports.buildInlineFkSql = exports.buildAlterNullSql = exports.buildAlterTypeSql = exports.buildDropColumnSql = exports.buildAddColumnSql = exports.renderColumn = void 0;
exports.handleIndexCreates = handleIndexCreates;
exports.buildIndexColumnsList = buildIndexColumnsList;
exports.handleFkCreates = handleFkCreates;
exports.handleColumnChanges = handleColumnChanges;
exports.buildCreateIndexSql = buildCreateIndexSql;
exports.buildIndexWhere = buildIndexWhere;
exports.buildIndexUsing = buildIndexUsing;
exports.buildIndexConcurrently = buildIndexConcurrently;
exports.buildIndexWithParams = buildIndexWithParams;
exports.buildIndexVisibility = buildIndexVisibility;
exports.buildIndexInclude = buildIndexInclude;
exports.handleAddColumnChange = handleAddColumnChange;
exports.handleAlterColumnChange = handleAlterColumnChange;
exports.handleDropColumnChange = handleDropColumnChange;
exports.isComputedColumn = isComputedColumn;
exports.hasDefaultExpression = hasDefaultExpression;
exports.isComputedChanged = isComputedChanged;
exports.hasTypeChanged = hasTypeChanged;
const SqlUtils_1 = require("./SqlUtils");
const ColumnHandlers_1 = require("./handlers/ColumnHandlers");
const ForeignKeyHandlers_1 = require("./handlers/ForeignKeyHandlers");
var ColumnHandlers_2 = require("./handlers/ColumnHandlers");
Object.defineProperty(exports, "renderColumn", { enumerable: true, get: function () { return ColumnHandlers_2.renderColumn; } });
Object.defineProperty(exports, "buildAddColumnSql", { enumerable: true, get: function () { return ColumnHandlers_2.buildAddColumnSql; } });
Object.defineProperty(exports, "buildDropColumnSql", { enumerable: true, get: function () { return ColumnHandlers_2.buildDropColumnSql; } });
Object.defineProperty(exports, "buildAlterTypeSql", { enumerable: true, get: function () { return ColumnHandlers_2.buildAlterTypeSql; } });
Object.defineProperty(exports, "buildAlterNullSql", { enumerable: true, get: function () { return ColumnHandlers_2.buildAlterNullSql; } });
var ForeignKeyHandlers_2 = require("./handlers/ForeignKeyHandlers");
Object.defineProperty(exports, "buildInlineFkSql", { enumerable: true, get: function () { return ForeignKeyHandlers_2.buildInlineFkSql; } });
Object.defineProperty(exports, "buildAddFkSql", { enumerable: true, get: function () { return ForeignKeyHandlers_2.buildAddFkSql; } });
Object.defineProperty(exports, "buildDropFkSql", { enumerable: true, get: function () { return ForeignKeyHandlers_2.buildDropFkSql; } });
var TableHandlers_1 = require("./handlers/TableHandlers");
Object.defineProperty(exports, "handleTableRename", { enumerable: true, get: function () { return TableHandlers_1.handleTableRename; } });
Object.defineProperty(exports, "handleCreateTable", { enumerable: true, get: function () { return TableHandlers_1.handleCreateTable; } });
Object.defineProperty(exports, "handleDropTable", { enumerable: true, get: function () { return TableHandlers_1.handleDropTable; } });
Object.defineProperty(exports, "buildCreateTableSql", { enumerable: true, get: function () { return TableHandlers_1.buildCreateTableSql; } });
function handleIndexCreates(td, dialect, up) {
    const ic = td.indexCreates;
    if (!ic || ic.length === 0)
        return;
    for (const idx of ic) {
        const hasCols = Array.isArray(idx.columns) && idx.columns.length > 0;
        const hasExpr = Array.isArray(idx.expressions) && idx.expressions.length > 0;
        if (!hasCols && !hasExpr)
            continue;
        up.push(buildCreateIndexSql(dialect, td.table, idx));
    }
}
function buildIndexColumnsList(dialect, columns, orders, collations, nulls, expressions) {
    const parts = [];
    for (const c of columns) {
        const ord = orders?.[c] ? ` ${orders[c]}` : '';
        const collation = collations?.[c]
            ? dialect === 'postgresql' || dialect === 'sqlite'
                ? ` COLLATE ${collations[c]}`
                : ''
            : '';
        const nullsSql = dialect === 'postgresql' && nulls?.[c] ? ` NULLS ${nulls[c]}` : '';
        parts.push(`${(0, SqlUtils_1.q)(dialect, c)}${ord}${collation}${nullsSql}`);
    }
    for (const e of expressions || [])
        parts.push(`(${e})`);
    return parts.join(', ');
}
var IndexHandlers_1 = require("./handlers/IndexHandlers");
Object.defineProperty(exports, "handleIndexDrops", { enumerable: true, get: function () { return IndexHandlers_1.handleIndexDrops; } });
function handleFkCreates(td, dialect, up) {
    const fkc = td.fkCreates;
    if (!fkc || fkc.length === 0)
        return;
    for (const fk of fkc) {
        const okCols = Array.isArray(fk.columns) && fk.columns.length > 0;
        const okRef = Array.isArray(fk.refColumns) && fk.refColumns.length > 0;
        if (!okCols || !okRef)
            continue;
        up.push((0, ForeignKeyHandlers_1.buildAddFkSql)(dialect, td.table, fk));
    }
}
var ForeignKeyHandlers_3 = require("./handlers/ForeignKeyHandlers");
Object.defineProperty(exports, "handleFkDrops", { enumerable: true, get: function () { return ForeignKeyHandlers_3.handleFkDrops; } });
function handleColumnChanges(td, dialect, up, down) {
    if (!td.columnChanges || td.columnChanges.length === 0)
        return;
    for (const ch of td.columnChanges) {
        if (ch.kind === 'add') {
            handleAddColumnChange(dialect, td, ch, up, down);
            continue;
        }
        if (ch.kind === 'alter') {
            handleAlterColumnChange(dialect, td, ch, up);
            continue;
        }
        if (ch.kind === 'drop') {
            handleDropColumnChange(dialect, td, ch, up);
        }
    }
}
function buildCreateIndexSql(dialect, table, idx) {
    const uniq = idx.unique ? 'UNIQUE ' : '';
    const name = (0, SqlUtils_1.q)(dialect, idx.name);
    const cols = buildIndexColumnsList(dialect, idx.columns, idx.orders, idx.collations, idx.nulls, idx.expressions);
    const where = buildIndexWhere(dialect, idx.where);
    const using = buildIndexUsing(dialect, idx.using);
    const concurrently = buildIndexConcurrently(dialect, idx.concurrently);
    const withSql = buildIndexWithParams(dialect, idx.withParams);
    const visibility = buildIndexVisibility(dialect, idx.mysqlVisibility);
    const include = buildIndexInclude(dialect, idx.include);
    switch (dialect) {
        case 'postgresql':
            return `CREATE ${uniq}INDEX${concurrently} ${name} ON ${(0, SqlUtils_1.q)(dialect, table)}${using} (${cols})${withSql}${where}`;
        case 'mysql':
            return `CREATE ${uniq}INDEX ${name} ON ${(0, SqlUtils_1.q)(dialect, table)} (${cols})${visibility}`;
        case 'mssql':
            return `CREATE ${uniq}INDEX ${name} ON ${(0, SqlUtils_1.q)(dialect, table)} (${cols})${include}${where}`;
        default:
            return `CREATE ${uniq}INDEX ${name} ON ${(0, SqlUtils_1.q)(dialect, table)} (${cols})${where}`;
    }
}
function buildIndexWhere(dialect, where) {
    return where && dialect !== 'mysql' ? ` WHERE ${where}` : '';
}
function buildIndexUsing(dialect, using) {
    return dialect === 'postgresql' && using ? ` USING ${using.toUpperCase()}` : '';
}
function buildIndexConcurrently(dialect, concurrently) {
    return dialect === 'postgresql' && concurrently ? ' CONCURRENTLY' : '';
}
function buildIndexWithParams(dialect, withParams) {
    if (dialect !== 'postgresql' || !withParams || Object.keys(withParams).length === 0)
        return '';
    const body = Object.entries(withParams)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? `'${v}'` : String(v)}`)
        .join(', ');
    return ` WITH (${body})`;
}
function buildIndexVisibility(dialect, visibility) {
    return dialect === 'mysql' && visibility ? ` ${visibility}` : '';
}
function buildIndexInclude(dialect, include) {
    return dialect === 'mssql' && include && include.length > 0
        ? ` INCLUDE (${include.map((c) => (0, SqlUtils_1.q)(dialect, c)).join(', ')})`
        : '';
}
function handleAddColumnChange(dialect, td, ch, up, down) {
    if (isComputedColumn(ch.column) || hasDefaultExpression(ch.column)) {
        const colSql = (0, ColumnHandlers_1.renderColumn)(dialect, ch.column);
        const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
        up.push(`ALTER TABLE ${(0, SqlUtils_1.q)(dialect, td.table)} ${kw} ${colSql}`);
    }
    else {
        up.push((0, ColumnHandlers_1.buildAddColumnSql)(dialect, td, ch.column.name, ch.column.type, ch.column.nullable, ch.column.defaultValue));
    }
    down.push((0, ColumnHandlers_1.buildDropColumnSql)(dialect, td.table, ch.column.name));
}
function handleAlterColumnChange(dialect, td, ch, up) {
    if (isComputedChanged(ch.prev, ch.column)) {
        up.push((0, ColumnHandlers_1.buildDropColumnSql)(dialect, td.table, ch.column.name));
        const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
        up.push(`ALTER TABLE ${(0, SqlUtils_1.q)(dialect, td.table)} ${kw} ${(0, ColumnHandlers_1.renderColumn)(dialect, ch.column)}`);
        return;
    }
    if (hasTypeChanged(ch.prev, ch.column)) {
        up.push((0, ColumnHandlers_1.buildAlterTypeSql)(dialect, td.table, ch.column.name, ch.column.type));
    }
    const prevNullable = ch.prev?.nullable;
    if (typeof prevNullable === 'boolean' && prevNullable !== ch.column.nullable) {
        up.push((0, ColumnHandlers_1.buildAlterNullSql)(dialect, td.table, ch.column.name, ch.column.nullable));
    }
}
function handleDropColumnChange(dialect, td, ch, up) {
    up.push((0, ColumnHandlers_1.buildDropColumnSql)(dialect, td.table, ch.column.name));
}
function isComputedColumn(c) {
    return (!!c.isComputed &&
        !!c.computedExpression);
}
function hasDefaultExpression(c) {
    return !!c.defaultExpression;
}
function isComputedChanged(prev, curr) {
    const p = prev;
    return (p?.isComputed !== curr.isComputed ||
        p?.computedExpression !== curr.computedExpression ||
        p?.computedStorage !== curr.computedStorage);
}
function hasTypeChanged(prev, curr) {
    return !!prev && (0, SqlUtils_1.norm)(prev.type) !== (0, SqlUtils_1.norm)(curr.type);
}
var ColumnHandlers_3 = require("./handlers/ColumnHandlers");
Object.defineProperty(exports, "handleColumnRenames", { enumerable: true, get: function () { return ColumnHandlers_3.handleColumnRenames; } });
// moved to handlers/TableHandlers.ts
// moved to handlers/ForeignKeyHandlers.ts
// moved to handlers/ForeignKeyHandlers.ts
// moved to handlers/ForeignKeyHandlers.ts
// moved to handlers/ColumnHandlers.ts
// moved to handlers/ColumnHandlers.ts
// moved to handlers/ColumnHandlers.ts
// moved to handlers/ColumnHandlers.ts
// moved to handlers/ColumnHandlers.ts
//# sourceMappingURL=MigrationHandlers.js.map