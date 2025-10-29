import { q, norm } from './SqlUtils';
import { renderColumn, buildAddColumnSql, buildDropColumnSql, buildAlterTypeSql, buildAlterNullSql } from './handlers/ColumnHandlers';
import { buildAddFkSql } from './handlers/ForeignKeyHandlers';
export { renderColumn, buildAddColumnSql, buildDropColumnSql, buildAlterTypeSql, buildAlterNullSql } from './handlers/ColumnHandlers';
export { buildInlineFkSql, buildAddFkSql, buildDropFkSql } from './handlers/ForeignKeyHandlers';
export { handleTableRename, handleCreateTable, handleDropTable, buildCreateTableSql } from './handlers/TableHandlers';
export function handleIndexCreates(td, dialect, up) {
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
export function buildIndexColumnsList(dialect, columns, orders, collations, nulls, expressions) {
    const parts = [];
    for (const c of columns) {
        const ord = orders?.[c] ? ` ${orders[c]}` : '';
        const collation = collations?.[c]
            ? dialect === 'postgresql' || dialect === 'sqlite'
                ? ` COLLATE ${collations[c]}`
                : ''
            : '';
        const nullsSql = dialect === 'postgresql' && nulls?.[c] ? ` NULLS ${nulls[c]}` : '';
        parts.push(`${q(dialect, c)}${ord}${collation}${nullsSql}`);
    }
    for (const e of expressions || [])
        parts.push(`(${e})`);
    return parts.join(', ');
}
export { handleIndexDrops } from './handlers/IndexHandlers';
export function handleFkCreates(td, dialect, up) {
    const fkc = td.fkCreates;
    if (!fkc || fkc.length === 0)
        return;
    for (const fk of fkc) {
        const okCols = Array.isArray(fk.columns) && fk.columns.length > 0;
        const okRef = Array.isArray(fk.refColumns) && fk.refColumns.length > 0;
        if (!okCols || !okRef)
            continue;
        up.push(buildAddFkSql(dialect, td.table, fk));
    }
}
export { handleFkDrops } from './handlers/ForeignKeyHandlers';
export function handleColumnChanges(td, dialect, up, down) {
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
export function buildCreateIndexSql(dialect, table, idx) {
    const uniq = idx.unique ? 'UNIQUE ' : '';
    const name = q(dialect, idx.name);
    const cols = buildIndexColumnsList(dialect, idx.columns, idx.orders, idx.collations, idx.nulls, idx.expressions);
    const where = buildIndexWhere(dialect, idx.where);
    const using = buildIndexUsing(dialect, idx.using);
    const concurrently = buildIndexConcurrently(dialect, idx.concurrently);
    const withSql = buildIndexWithParams(dialect, idx.withParams);
    const visibility = buildIndexVisibility(dialect, idx.mysqlVisibility);
    const include = buildIndexInclude(dialect, idx.include);
    switch (dialect) {
        case 'postgresql':
            return `CREATE ${uniq}INDEX${concurrently} ${name} ON ${q(dialect, table)}${using} (${cols})${withSql}${where}`;
        case 'mysql':
            return `CREATE ${uniq}INDEX ${name} ON ${q(dialect, table)} (${cols})${visibility}`;
        case 'mssql':
            return `CREATE ${uniq}INDEX ${name} ON ${q(dialect, table)} (${cols})${include}${where}`;
        default:
            return `CREATE ${uniq}INDEX ${name} ON ${q(dialect, table)} (${cols})${where}`;
    }
}
export function buildIndexWhere(dialect, where) {
    return where && dialect !== 'mysql' ? ` WHERE ${where}` : '';
}
export function buildIndexUsing(dialect, using) {
    return dialect === 'postgresql' && using ? ` USING ${using.toUpperCase()}` : '';
}
export function buildIndexConcurrently(dialect, concurrently) {
    return dialect === 'postgresql' && concurrently ? ' CONCURRENTLY' : '';
}
export function buildIndexWithParams(dialect, withParams) {
    if (dialect !== 'postgresql' || !withParams || Object.keys(withParams).length === 0)
        return '';
    const body = Object.entries(withParams)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? `'${v}'` : String(v)}`)
        .join(', ');
    return ` WITH (${body})`;
}
export function buildIndexVisibility(dialect, visibility) {
    return dialect === 'mysql' && visibility ? ` ${visibility}` : '';
}
export function buildIndexInclude(dialect, include) {
    return dialect === 'mssql' && include && include.length > 0
        ? ` INCLUDE (${include.map((c) => q(dialect, c)).join(', ')})`
        : '';
}
export function handleAddColumnChange(dialect, td, ch, up, down) {
    if (isComputedColumn(ch.column) || hasDefaultExpression(ch.column)) {
        const colSql = renderColumn(dialect, ch.column);
        const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
        up.push(`ALTER TABLE ${q(dialect, td.table)} ${kw} ${colSql}`);
    }
    else {
        up.push(buildAddColumnSql(dialect, td, ch.column.name, ch.column.type, ch.column.nullable, ch.column.defaultValue));
    }
    down.push(buildDropColumnSql(dialect, td.table, ch.column.name));
}
export function handleAlterColumnChange(dialect, td, ch, up) {
    if (isComputedChanged(ch.prev, ch.column)) {
        up.push(buildDropColumnSql(dialect, td.table, ch.column.name));
        const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
        up.push(`ALTER TABLE ${q(dialect, td.table)} ${kw} ${renderColumn(dialect, ch.column)}`);
        return;
    }
    if (hasTypeChanged(ch.prev, ch.column)) {
        up.push(buildAlterTypeSql(dialect, td.table, ch.column.name, ch.column.type));
    }
    const prevNullable = ch.prev?.nullable;
    if (typeof prevNullable === 'boolean' && prevNullable !== ch.column.nullable) {
        up.push(buildAlterNullSql(dialect, td.table, ch.column.name, ch.column.nullable));
    }
}
export function handleDropColumnChange(dialect, td, ch, up) {
    up.push(buildDropColumnSql(dialect, td.table, ch.column.name));
}
export function isComputedColumn(c) {
    return (!!c.isComputed &&
        !!c.computedExpression);
}
export function hasDefaultExpression(c) {
    return !!c.defaultExpression;
}
export function isComputedChanged(prev, curr) {
    const p = prev;
    return (p?.isComputed !== curr.isComputed ||
        p?.computedExpression !== curr.computedExpression ||
        p?.computedStorage !== curr.computedStorage);
}
export function hasTypeChanged(prev, curr) {
    return !!prev && norm(prev.type) !== norm(curr.type);
}
export { handleColumnRenames } from './handlers/ColumnHandlers';
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