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
}
//# sourceMappingURL=SchemaInspector.js.map