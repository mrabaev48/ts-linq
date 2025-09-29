"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMigrationFromDiff = generateMigrationFromDiff;
function generateMigrationFromDiff(diff, dialect) {
    const up = [];
    const down = [];
    for (const tableDiff of diff.tables) {
        if (tableDiff.renameTo) {
            const to = tableDiff.renameTo;
            switch (dialect) {
                case 'postgresql':
                    up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} RENAME TO ${q(dialect, to)}`);
                    break;
                case 'mysql':
                    up.push(`RENAME TABLE ${q(dialect, tableDiff.table)} TO ${q(dialect, to)}`);
                    break;
                case 'mssql':
                    up.push(`EXEC sp_rename '${tableDiff.table}', '${to}'`);
                    break;
                default:
                    up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} RENAME TO ${q(dialect, to)}`);
            }
        }
        if (tableDiff.create) {
            up.push(buildCreateTableSql(tableDiff, dialect));
            // create indexes if defined
            if (tableDiff.create.indexes && tableDiff.create.indexes.length > 0) {
                for (const idx of tableDiff.create.indexes) {
                    const uniq = idx.unique ? 'UNIQUE ' : '';
                    const cols = idx.columns.map((column) => q(dialect, column)).join(', ');
                    const name = q(dialect, idx.name);
                    const where = idx.where && dialect !== 'mysql' ? ` WHERE ${idx.where}` : '';
                    up.push(`CREATE ${uniq}INDEX ${name} ON ${q(dialect, tableDiff.create.name)} (${cols})${where}`);
                }
            }
            down.push(`DROP TABLE ${q(dialect, tableDiff.create.name)}`);
            continue;
        }
        if (tableDiff.drop) {
            up.push(`DROP TABLE ${q(dialect, tableDiff.table)}`);
            // Down is unknown without a snapshot; omitted
            continue;
        }
        if (tableDiff.indexCreates &&
            tableDiff.indexCreates.length > 0) {
            for (const idx of tableDiff.indexCreates) {
                const uniq = idx.unique ? 'UNIQUE ' : '';
                const name = q(dialect, idx.name);
                const parts = [];
                for (const c of idx.columns) {
                    const ord = idx.orders?.[c] ? ` ${idx.orders[c]}` : '';
                    const collation = idx.collations?.[c]
                        ? dialect === 'postgresql' || dialect === 'sqlite'
                            ? ` COLLATE ${idx.collations[c]}`
                            : ''
                        : '';
                    const nulls = dialect === 'postgresql' && idx.nulls?.[c] ? ` NULLS ${idx.nulls[c]}` : '';
                    parts.push(`${q(dialect, c)}${ord}${collation}${nulls}`);
                }
                for (const e of idx.expressions || [])
                    parts.push(`(${e})`);
                const cols = parts.join(', ');
                const where = idx.where && dialect !== 'mysql' ? ` WHERE ${idx.where}` : '';
                const using = dialect === 'postgresql' && idx.using ? ` USING ${idx.using.toUpperCase()}` : '';
                const concurrently = dialect === 'postgresql' && idx.concurrently ? ' CONCURRENTLY' : '';
                const withSql = dialect === 'postgresql' && idx.withParams && Object.keys(idx.withParams).length > 0
                    ? ` WITH (${Object.entries(idx.withParams)
                        .map(([k, v]) => `${k}=${typeof v === 'string' ? `'${v}'` : String(v)}`)
                        .join(', ')})`
                    : '';
                const visibility = dialect === 'mysql' && idx.mysqlVisibility ? ` ${idx.mysqlVisibility}` : '';
                const include = dialect === 'mssql' && idx.include && idx.include.length > 0
                    ? ` INCLUDE (${idx.include.map((c) => q(dialect, c)).join(', ')})`
                    : '';
                switch (dialect) {
                    case 'postgresql':
                        up.push(`CREATE ${uniq}INDEX${concurrently} ${name} ON ${q(dialect, tableDiff.table)}${using} (${cols})${withSql}${where}`);
                        break;
                    case 'mysql':
                        up.push(`CREATE ${uniq}INDEX ${name} ON ${q(dialect, tableDiff.table)} (${cols})${visibility}`);
                        break;
                    case 'mssql':
                        up.push(`CREATE ${uniq}INDEX ${name} ON ${q(dialect, tableDiff.table)} (${cols})${include}${where}`);
                        break;
                    default:
                        up.push(`CREATE ${uniq}INDEX ${name} ON ${q(dialect, tableDiff.table)} (${cols})${where}`);
                }
            }
        }
        if (tableDiff.indexDrops &&
            tableDiff.indexDrops.length > 0) {
            for (const nameRaw of tableDiff.indexDrops) {
                switch (dialect) {
                    case 'postgresql':
                        up.push(`DROP INDEX IF EXISTS ${q(dialect, nameRaw)}`);
                        break;
                    case 'mysql':
                        up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} DROP INDEX ${q(dialect, nameRaw)}`);
                        break;
                    case 'mssql':
                        up.push(`DROP INDEX ${q(dialect, nameRaw)} ON ${q(dialect, tableDiff.table)}`);
                        break;
                    default:
                        up.push(`DROP INDEX IF EXISTS ${q(dialect, nameRaw)}`);
                }
            }
        }
        if (tableDiff.fkCreates &&
            tableDiff.fkCreates.length > 0) {
            for (const fk of tableDiff.fkCreates) {
                const name = fk.name ? `CONSTRAINT ${q(dialect, fk.name)} ` : '';
                const cols = fk.columns.map((column) => q(dialect, column)).join(', ');
                const refCols = fk.refColumns.map((column) => q(dialect, column)).join(', ');
                const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
                const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
                switch (dialect) {
                    case 'postgresql':
                    case 'mysql':
                    case 'mssql':
                        up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} ADD ${name}FOREIGN KEY (${cols}) REFERENCES ${q(dialect, fk.refTable)} (${refCols})${onDel}${onUpd}`);
                        break;
                    default:
                        up.push(`-- SQLite requires table rebuild to add FK: ${name}(${cols}) -> ${fk.refTable}(${refCols})`);
                }
            }
        }
        if (tableDiff.fkDrops &&
            tableDiff.fkDrops.length > 0) {
            for (const nameRaw of tableDiff.fkDrops) {
                switch (dialect) {
                    case 'postgresql':
                        up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} DROP CONSTRAINT ${q(dialect, nameRaw)}`);
                        break;
                    case 'mysql':
                        up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} DROP FOREIGN KEY ${q(dialect, nameRaw)}`);
                        break;
                    case 'mssql':
                        up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} DROP CONSTRAINT ${q(dialect, nameRaw)}`);
                        break;
                    default:
                        up.push(`-- SQLite requires table rebuild to drop FK: ${nameRaw}`);
                }
            }
        }
        if (tableDiff.columnChanges && tableDiff.columnChanges.length > 0) {
            for (const ch of tableDiff.columnChanges) {
                if (ch.kind === 'add') {
                    if (ch.column.isComputed &&
                        ch.column.computedExpression) {
                        // Use full column rendering for computed columns
                        const colSql = renderColumn(dialect, ch.column);
                        const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
                        up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} ${kw} ${colSql}`);
                    }
                    else if (ch.column.defaultExpression) {
                        // Use full column rendering to include defaultExpression
                        const colSql = renderColumn(dialect, ch.column);
                        const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
                        up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} ${kw} ${colSql}`);
                    }
                    else {
                        up.push(buildAddColumnSql(dialect, tableDiff, ch.column.name, ch.column.type, ch.column.nullable, ch.column.defaultValue));
                    }
                    down.push(buildDropColumnSql(dialect, tableDiff.table, ch.column.name));
                }
                else if (ch.kind === 'alter') {
                    // Separate type and nullability handling
                    const alterType = ch.prev && norm(ch.prev.type) !== norm(ch.column.type);
                    // For computed changes, prefer drop + add (dialect-safe baseline)
                    const computedChanged = ch.prev?.isComputed !== ch.column.isComputed ||
                        ch.prev?.computedExpression !==
                            ch.column.computedExpression ||
                        ch.prev?.computedStorage !==
                            ch.column.computedStorage;
                    if (computedChanged) {
                        // baseline: drop then add
                        up.push(buildDropColumnSql(dialect, tableDiff.table, ch.column.name));
                        const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
                        up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} ${kw} ${renderColumn(dialect, ch.column)}`);
                        continue;
                    }
                    if (alterType)
                        up.push(buildAlterTypeSql(dialect, tableDiff.table, ch.column.name, ch.column.type));
                    const prevNullable = ch.prev?.nullable;
                    if (typeof prevNullable === 'boolean' && prevNullable !== ch.column.nullable) {
                        up.push(buildAlterNullSql(dialect, tableDiff.table, ch.column.name, ch.column.nullable));
                    }
                }
                else if (ch.kind === 'drop') {
                    // Generate DROP COLUMN for dialects that support it
                    up.push(buildDropColumnSql(dialect, tableDiff.table, ch.column.name));
                }
            }
        }
        if (tableDiff
            .columnRenames &&
            tableDiff
                .columnRenames.length > 0) {
            for (const rn of tableDiff.columnRenames) {
                switch (dialect) {
                    case 'postgresql':
                        up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} RENAME COLUMN ${q(dialect, rn.from)} TO ${q(dialect, rn.to)}`);
                        break;
                    case 'mysql':
                        // MySQL requires full type in MODIFY/CHANGE COLUMN — leave as comment
                        up.push(`-- MySQL requires full type for CHANGE COLUMN ${rn.from} -> ${rn.to}`);
                        break;
                    case 'mssql':
                        up.push(`EXEC sp_rename '${tableDiff.table}.${rn.from}', '${rn.to}', 'COLUMN'`);
                        break;
                    default:
                        up.push(`-- SQLite column rename requires pragma or rebuild: ${rn.from} -> ${rn.to}`);
                }
            }
        }
    }
    return { up, down };
}
function buildCreateTableSql(td, dialect) {
    const create = td.create;
    const cols = create.columns.map((c) => renderColumn(dialect, c));
    if (create.primaryKeys && create.primaryKeys.length > 0)
        cols.push(`PRIMARY KEY (${create.primaryKeys.map((pk) => q(dialect, pk)).join(', ')})`);
    if (create.foreignKeys && create.foreignKeys.length > 0) {
        for (const fk of create.foreignKeys) {
            const name = fk.name ? `CONSTRAINT ${q(dialect, fk.name)} ` : '';
            const colsList = fk.columns.map((c) => q(dialect, c)).join(', ');
            const refCols = fk.refColumns.map((c) => q(dialect, c)).join(', ');
            const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
            const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
            cols.push(`${name}FOREIGN KEY (${colsList}) REFERENCES ${q(dialect, fk.refTable)} (${refCols})${onDel}${onUpd}`);
        }
    }
    return `CREATE TABLE IF NOT EXISTS ${q(dialect, create.name)} (${cols.join(', ')})`;
}
function renderColumn(dialect, c) {
    if (c.isComputed && c.computedExpression) {
        switch (dialect) {
            case 'postgresql':
                return `${q(dialect, c.name)} ${mapType(dialect, c.type)} GENERATED ALWAYS AS (${c.computedExpression}) STORED`;
            case 'mysql': {
                const kind = c.computedStorage === 'STORED' ? 'STORED' : 'VIRTUAL';
                return `${q(dialect, c.name)} ${mapType(dialect, c.type)} GENERATED ALWAYS AS (${c.computedExpression}) ${kind}`;
            }
            case 'mssql': {
                const persisted = c.computedStorage === 'PERSISTED' ? ' PERSISTED' : '';
                return `${q(dialect, c.name)} AS (${c.computedExpression})${persisted}`;
            }
            default: {
                const kind = c.computedStorage === 'STORED' ? 'STORED' : 'VIRTUAL';
                return `${q(dialect, c.name)} GENERATED ALWAYS AS (${c.computedExpression}) ${kind}`;
            }
        }
    }
    const dialectMap = c.defaultExpressionDialect || {};
    const defExpr = dialectMap[dialect] || c.defaultExpression;
    const defSql = defExpr
        ? ` DEFAULT ${defExpr}`
        : c.defaultValue !== undefined
            ? ' DEFAULT ' + formatValue(dialect, c.defaultValue)
            : '';
    return `${q(dialect, c.name)} ${mapType(dialect, c.type)}${c.nullable ? '' : ' NOT NULL'}${defSql}`;
}
function buildAddColumnSql(dialect, td, name, type, nullable, def) {
    const table = q(dialect, td.table);
    const col = q(dialect, name);
    const typeSql = mapType(dialect, type);
    const nn = nullable ? '' : ' NOT NULL';
    const d = def !== undefined ? ` DEFAULT ${formatValue(dialect, def)}` : '';
    const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
    return `ALTER TABLE ${table} ${kw} ${col} ${typeSql}${nn}${d}`;
}
function buildDropColumnSql(dialect, table, name) {
    if (dialect === 'sqlite')
        return `-- DROP COLUMN ${name} is not supported directly in SQLite`;
    return `ALTER TABLE ${q(dialect, table)} DROP COLUMN ${q(dialect, name)}`;
}
function buildAlterTypeSql(dialect, table, name, newType) {
    const tableName = q(dialect, table);
    const columnName = q(dialect, name);
    const mappedType = mapType(dialect, newType);
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
    const tableName = q(dialect, table);
    const columnName = q(dialect, name);
    switch (dialect) {
        case 'postgresql':
            return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${nullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`;
        case 'mysql':
            // MySQL requires full type; use a generic comment placeholder here
            return `-- MySQL requires full type in MODIFY for nullability; include in type alter`;
        case 'mssql':
            return `-- MSSQL requires full type in ALTER COLUMN for nullability; include in type alter`;
        default:
            return `-- SQLite nullability alter requires rebuild`;
    }
}
function q(dialect, id) {
    switch (dialect) {
        case 'postgresql':
            return '"' + id + '"';
        case 'mysql':
            return '`' + id + '`';
        case 'mssql':
            return '[' + id + ']';
        default:
            return id;
    }
}
function mapType(dialect, t) {
    const up = String(t || '').toUpperCase();
    switch (dialect) {
        case 'postgresql':
            if (up === 'INTEGER' || up === 'NUMBER')
                return 'INTEGER';
            if (up === 'TEXT' || up === 'STRING')
                return 'TEXT';
            if (up === 'BOOLEAN')
                return 'BOOLEAN';
            if (up === 'DATETIME' || up === 'DATE')
                return 'TIMESTAMPTZ';
            if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE')
                return 'DOUBLE PRECISION';
            return up;
        case 'mysql':
            if (up === 'INTEGER' || up === 'NUMBER')
                return 'INT';
            if (up === 'TEXT' || up === 'STRING')
                return 'TEXT';
            if (up === 'BOOLEAN')
                return 'TINYINT(1)';
            if (up === 'DATETIME' || up === 'DATE')
                return 'DATETIME';
            if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE')
                return 'DOUBLE';
            return up;
        case 'mssql':
            if (up === 'INTEGER' || up === 'NUMBER')
                return 'INT';
            if (up === 'TEXT' || up === 'STRING')
                return 'NVARCHAR(MAX)';
            if (up === 'BOOLEAN')
                return 'BIT';
            if (up === 'DATETIME' || up === 'DATE')
                return 'DATETIME2';
            if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE')
                return 'FLOAT';
            return up;
        default:
            if (up === 'INTEGER' || up === 'NUMBER')
                return 'INTEGER';
            if (up === 'TEXT' || up === 'STRING')
                return 'TEXT';
            if (up === 'BOOLEAN')
                return 'INTEGER';
            if (up === 'DATETIME' || up === 'DATE')
                return 'TEXT';
            if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE')
                return 'REAL';
            return up;
    }
}
function formatValue(dialect, v) {
    if (v === null)
        return 'NULL';
    if (typeof v === 'number')
        return String(v);
    if (typeof v === 'boolean') {
        switch (dialect) {
            case 'postgresql':
                return v ? 'TRUE' : 'FALSE';
            case 'mysql':
            case 'sqlite':
            default:
                return v ? '1' : '0';
            case 'mssql':
                return v ? '1' : '0';
        }
    }
    if (v instanceof Date)
        return `'${v.toISOString()}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
}
function norm(t) {
    return String(t || '')
        .trim()
        .toUpperCase();
}
//# sourceMappingURL=DialectMigrationSql.js.map