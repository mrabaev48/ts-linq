"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDbType = normalizeDbType;
exports.tsTypeForOrm = tsTypeForOrm;
exports.inspectTable = inspectTable;
exports.listAllTables = listAllTables;
function normalizeDbType(label, dbTypeRaw) {
    const t = String(dbTypeRaw || '').toLowerCase();
    if (label === 'sqlite') {
        if (/int/.test(t))
            return 'INTEGER';
        if (/real|double|float/.test(t))
            return 'REAL';
        if (/blob/.test(t))
            return 'BLOB';
        if (/date|time/.test(t))
            return 'DATETIME';
        if (/bool/.test(t))
            return 'BOOLEAN';
        return 'TEXT';
    }
    if (label === 'postgresql') {
        if (/(?:small|big)?int|serial|bigserial/.test(t))
            return 'INTEGER';
        if (/numeric|decimal/.test(t))
            return 'DECIMAL';
        if (/double|real/.test(t))
            return 'REAL';
        if (/uuid/.test(t))
            return 'UUID';
        if (/jsonb?/.test(t))
            return t.includes('jsonb') ? 'JSONB' : 'JSON';
        if (/timestamp|timestamptz|date|time/.test(t))
            return 'DATETIME';
        if (/bool/.test(t))
            return 'BOOLEAN';
        if (/bytea/.test(t))
            return 'BLOB';
        return 'TEXT';
    }
    if (label === 'mysql') {
        if (/int/.test(t))
            return 'INTEGER';
        if (/decimal|numeric/.test(t))
            return 'DECIMAL';
        if (/double|float/.test(t))
            return 'REAL';
        if (/json/.test(t))
            return 'JSON';
        if (/datetime|timestamp|date|time/.test(t))
            return 'DATETIME';
        if (/bool|tinyint\(1\)/.test(t))
            return 'BOOLEAN';
        if (/blob|binary|varbinary/.test(t))
            return 'BLOB';
        return 'TEXT';
    }
    // mssql
    if (/int|bigint|smallint|tinyint/.test(t))
        return 'INTEGER';
    if (/decimal|numeric|money|smallmoney/.test(t))
        return 'DECIMAL';
    if (/float|real/.test(t))
        return 'REAL';
    if (/datetime|smalldatetime|date|time/.test(t))
        return 'DATETIME';
    if (/bit/.test(t))
        return 'BOOLEAN';
    if (/binary|varbinary|image/.test(t))
        return 'BLOB';
    if (/uniqueidentifier/.test(t))
        return 'UUID';
    return 'TEXT';
}
function tsTypeForOrm(colType) {
    switch (colType) {
        case 'INTEGER':
        case 'REAL':
        case 'DECIMAL':
            return 'number';
        case 'BOOLEAN':
            return 'boolean';
        case 'DATETIME':
            return 'Date';
        case 'BLOB':
            return 'Buffer';
        case 'UUID':
            return 'string';
        case 'JSON':
        case 'JSONB':
            return 'unknown';
        default:
            return 'string';
    }
}
async function inspectTable(provider, label, table, schema) {
    const rows = [];
    if (label === 'sqlite') {
        const pragma = await provider.executeQuery(`PRAGMA table_info(${table})`);
        for (const r of pragma)
            rows.push({ name: r.name, type: r.type, nullable: !r.notnull, pk: !!r.pk });
    }
    else if (label === 'postgresql') {
        const sch = schema || 'public';
        const cols = await provider.executeQuery('SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position', [sch, table]);
        const pkCols = await provider.executeQuery("SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position", [sch, table]);
        const pkSet = new Set(pkCols.map((x) => x.column_name));
        for (const c of cols) {
            const raw = (c.udt_name || c.data_type || '').toLowerCase();
            rows.push({ name: c.column_name, type: raw, nullable: c.is_nullable === 'YES', pk: pkSet.has(c.column_name) });
        }
    }
    else if (label === 'mysql') {
        const cols = await provider.executeQuery('SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION', [table]);
        for (const c of cols)
            rows.push({ name: c.COLUMN_NAME, type: c.DATA_TYPE, nullable: c.IS_NULLABLE === 'YES', pk: c.COLUMN_KEY === 'PRI' });
    }
    else {
        const sch = schema || 'dbo';
        const cols = await provider.executeQuery('SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @p1 AND TABLE_NAME = @p2 ORDER BY ORDINAL_POSITION', [sch, table]);
        const pkCols = await provider.executeQuery("SELECT k.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON t.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND t.TABLE_SCHEMA = k.TABLE_SCHEMA WHERE t.TABLE_SCHEMA = @p1 AND t.TABLE_NAME = @p2 AND t.CONSTRAINT_TYPE = 'PRIMARY KEY' ORDER BY k.ORDINAL_POSITION", [sch, table]);
        const pkSet = new Set(pkCols.map((x) => x.COLUMN_NAME));
        for (const c of cols)
            rows.push({ name: c.COLUMN_NAME, type: c.DATA_TYPE, nullable: c.IS_NULLABLE === 'YES', pk: pkSet.has(c.COLUMN_NAME) });
    }
    return rows.map((r) => ({
        name: r.name,
        dbType: r.type,
        ormType: normalizeDbType(label, r.type),
        nullable: r.nullable,
        isPrimary: r.pk
    }));
}
async function listAllTables(provider, label, schema) {
    if (label === 'sqlite') {
        const rows = await provider.executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        return rows.map((r) => r.name);
    }
    if (label === 'postgresql') {
        const sch = schema || 'public';
        const rows = await provider.executeQuery('SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename', [sch]);
        return rows.map((r) => r.tablename);
    }
    if (label === 'mysql') {
        const rows = await provider.executeQuery('SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_TYPE = "BASE TABLE" ORDER BY TABLE_NAME');
        return rows.map((r) => r.TABLE_NAME);
    }
    const sch = schema || 'dbo';
    const rows = await provider.executeQuery('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @p1 AND TABLE_TYPE = "BASE TABLE" ORDER BY TABLE_NAME', [sch]);
    return rows.map((r) => r.TABLE_NAME);
}
//# sourceMappingURL=schema-inspect.js.map