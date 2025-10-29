export function q(dialect, id) {
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
export function mapType(dialect, t) {
    const up = String(t || '').toUpperCase();
    const group = groupType(up);
    if (!group)
        return up;
    const perDialect = {
        postgresql: {
            int: 'INTEGER',
            text: 'TEXT',
            bool: 'BOOLEAN',
            date: 'TIMESTAMPTZ',
            float: 'DOUBLE PRECISION'
        },
        mysql: {
            int: 'INT',
            text: 'TEXT',
            bool: 'TINYINT(1)',
            date: 'DATETIME',
            float: 'DOUBLE'
        },
        mssql: {
            int: 'INT',
            text: 'NVARCHAR(MAX)',
            bool: 'BIT',
            date: 'DATETIME2',
            float: 'FLOAT'
        },
        sqlite: {
            int: 'INTEGER',
            text: 'TEXT',
            bool: 'INTEGER',
            date: 'TEXT',
            float: 'REAL'
        }
    };
    return perDialect[dialect][group];
}
export function groupType(up) {
    if (up === 'INTEGER' || up === 'NUMBER')
        return 'int';
    if (up === 'TEXT' || up === 'STRING')
        return 'text';
    if (up === 'BOOLEAN')
        return 'bool';
    if (up === 'DATETIME' || up === 'DATE')
        return 'date';
    if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE')
        return 'float';
    return null;
}
export function formatValue(dialect, v) {
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
export function norm(t) {
    return String(t || '')
        .trim()
        .toUpperCase();
}
//# sourceMappingURL=SqlUtils.js.map