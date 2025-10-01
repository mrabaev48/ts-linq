/** Simple SQLite schema inspector using sqlite_master and PRAGMA table_info. */
export class SQLiteSchemaInspector {
    constructor(provider) {
        this.provider = provider;
    }
    async listTables() {
        const rows = await this.provider.executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        return rows.map((r) => r.name);
    }
    async getTableInfo(table) {
        const cols = await this.provider.executeQuery(`PRAGMA table_info(${table})`);
        return { name: table, columns: cols };
    }
    async getIndexes(table) {
        const list = await this.provider.executeQuery(`PRAGMA index_list(${table})`);
        const result = [];
        for (const row of list) {
            const cols = await this.provider.executeQuery(`PRAGMA index_info(${row.name})`);
            const sqlRows = await this.provider.executeQuery(`SELECT sql FROM sqlite_master WHERE type='index' AND name='${row.name}'`);
            const sql = sqlRows[0]?.sql || null;
            const where = extractWhereClause(sql || undefined);
            result.push({
                name: row.name,
                columns: cols.map((c) => c.name),
                unique: !!row.unique,
                where: where || undefined
            });
        }
        return result;
    }
}
function extractWhereClause(sql) {
    if (!sql)
        return null;
    const m = /\sWHERE\s+(.+)$/i.exec(sql.trim());
    return m ? m[1] : null;
}
/** PostgreSQL schema inspector using pg_catalog views. */
export class PostgresSchemaInspector {
    constructor(provider) {
        this.provider = provider;
    }
    async listTables() {
        const rows = await this.provider.executeQuery("SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY tablename");
        return rows.map((r) => r.tablename);
    }
    async getIndexes(table) {
        const rows = await this.provider.executeQuery('SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1', [table]);
        const result = [];
        for (const r of rows) {
            const def = r.indexdef || '';
            const unique = /^CREATE\s+UNIQUE\s+INDEX/i.test(def);
            // Extract parts inside parentheses after ON <table> (...). Table may be schema-qualified with quoted identifiers.
            const match = /ON\s+[^()]+\((.+?)\)(?:\s+WHERE\s+(.+))?$/i.exec(def);
            const list = match?.[1] || '';
            const where = match?.[2] || undefined;
            const parts = list.split(',').map((s) => s.trim());
            const columns = [];
            for (const p of parts) {
                // p like '"col" ASC' or '(LOWER(col))'
                if (p.startsWith('(')) {
                    // expression: skip from columns list for portability in diff
                    continue;
                }
                const cleaned = p.replace(/^"|"$/g, '').replace(/\s+(ASC|DESC)$/i, '');
                columns.push(cleaned);
            }
            result.push({ name: r.indexname, columns, unique, where });
        }
        return result;
    }
}
/** MySQL schema inspector using information_schema.statistics. */
export class MySqlSchemaInspector {
    constructor(provider) {
        this.provider = provider;
    }
    async listTables() {
        const rows = await this.provider.executeQuery("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
        return rows.map((r) => r.TABLE_NAME);
    }
    async getIndexes(table) {
        const rows = await this.provider.executeQuery('SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX, COLLATION, EXPRESSION FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX', [table]);
        const byName = new Map();
        for (const r of rows) {
            const name = r.INDEX_NAME;
            if (!byName.has(name))
                byName.set(name, { name, columns: [], unique: r.NON_UNIQUE === 0, _parts: [] });
            const entry = byName.get(name);
            if (r.COLUMN_NAME)
                entry._parts.push({ col: r.COLUMN_NAME });
            else if (r.EXPRESSION)
                entry._parts.push({ expr: r.EXPRESSION });
        }
        const result = [];
        for (const e of byName.values()) {
            const cols = e._parts.filter((p) => p.col).map((p) => p.col);
            result.push({ name: e.name, columns: cols, unique: e.unique });
        }
        return result;
    }
}
/** MSSQL schema inspector using sys catalog views. */
export class MssqlSchemaInspector {
    constructor(provider) {
        this.provider = provider;
    }
    async listTables() {
        const rows = await this.provider.executeQuery('SELECT name FROM sys.tables ORDER BY name');
        return rows.map((r) => r.name);
    }
    async getIndexes(table) {
        const idxRows = await this.provider.executeQuery('SELECT i.name, i.is_unique, i.filter_definition FROM sys.indexes i WHERE i.object_id = OBJECT_ID(@p1) AND i.is_hypothetical = 0 AND i.name IS NOT NULL', [table]);
        const colRows = await this.provider.executeQuery('SELECT i.name as index_name, c.name as column_name, ic.key_ordinal, ic.is_descending_key FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=i.object_id AND c.column_id=ic.column_id WHERE i.object_id = OBJECT_ID(@p1) ORDER BY i.name, ic.key_ordinal', [table]);
        const byName = new Map();
        for (const r of idxRows) {
            byName.set(r.name, {
                name: r.name,
                columns: [],
                unique: r.is_unique === 1,
                where: r.filter_definition || undefined,
                _cols: []
            });
        }
        for (const r of colRows) {
            const e = byName.get(r.index_name);
            if (e)
                e._cols.push(r.column_name);
        }
        const result = [];
        for (const e of byName.values()) {
            result.push({ name: e.name, columns: e._cols, unique: e.unique, where: e.where });
        }
        return result;
    }
}
//# sourceMappingURL=SchemaInspector.js.map