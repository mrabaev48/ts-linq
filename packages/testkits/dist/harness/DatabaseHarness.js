export class DatabaseHarness {
    constructor() {
        this.cleanup = [];
    }
    async setup(options) {
        this.provider = options.provider;
        if (options.autoConnect !== false) {
            await this.provider.connect();
            this.cleanup.push(() => this.provider.disconnect());
        }
        return this.provider;
    }
    async createSchema(provider, entities) {
        for (const entity of entities) {
            const tableName = this.getTableName(entity);
            await provider.execute(`CREATE TABLE IF EXISTS ${tableName} (id INTEGER PRIMARY KEY)`, []);
        }
    }
    async dropSchema(provider, entities) {
        for (const entity of entities.reverse()) {
            const tableName = this.getTableName(entity);
            await provider.execute(`DROP TABLE IF EXISTS ${tableName}`, []);
        }
    }
    async seed(provider, entity, data) {
        const tableName = this.getTableName(entity);
        for (const item of data) {
            const keys = Object.keys(item);
            const values = Object.values(item);
            const placeholders = values.map((_, i) => `?`).join(', ');
            const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
            await provider.execute(sql, values);
        }
    }
    async teardown() {
        for (const fn of this.cleanup.reverse()) {
            await fn();
        }
        this.cleanup = [];
        this.provider = undefined;
    }
    getTableName(entity) {
        return entity.name.toLowerCase();
    }
}
export function createDatabaseHarness() {
    return new DatabaseHarness();
}
//# sourceMappingURL=DatabaseHarness.js.map