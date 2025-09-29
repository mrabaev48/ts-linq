"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DiffMigrationGenerator_1 = require("../../src/migrations/DiffMigrationGenerator");
const MetadataStorage_1 = require("../../src/metadata/MetadataStorage");
const DatabaseProvider_1 = require("../../src/DatabaseProvider");
class FakeProvider extends DatabaseProvider_1.DatabaseProvider {
    constructor(label, responses) {
        super('');
        this.label = label;
        this.responses = responses;
        this.providerName = label;
    }
    async connect() { }
    async disconnect() { }
    async createTable() { }
    getDialect() {
        return {};
    }
    async insert(entity) {
        return entity;
    }
    async update(entity) {
        return entity;
    }
    async delete() { }
    async findById() {
        return null;
    }
    async findAll() {
        return [];
    }
    async findWhere() {
        return [];
    }
    async findWhereIn() {
        return [];
    }
    async beginTransaction() { }
    async commitTransaction() { }
    async rollbackTransaction() { }
    async doExecuteQuery(sql, _params) {
        const hit = this.responses.find((r) => r.like.test(sql));
        return hit?.rows || [];
    }
    async doExecuteNonQuery() {
        return 0;
    }
}
function registerUsers(withIndex) {
    class User {
    }
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    MetadataStorage_1.MetadataStorage.addEntity(User, 'Users');
    const cols = [
        {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false
        },
        {
            propertyName: 'active',
            columnName: 'active',
            type: 'BOOLEAN',
            nullable: false
        },
        {
            propertyName: 'email',
            columnName: 'email',
            type: 'TEXT',
            nullable: false
        }
    ];
    cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(User, c));
    MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
    MetadataStorage_1.MetadataStorage.addIndex(User, {
        name: withIndex.name,
        columns: withIndex.columns,
        unique: withIndex.unique,
        where: withIndex.where
    });
}
test('DiffMigrationGenerator uses Postgres inspector to create missing filtered index', async () => {
    registerUsers({
        name: 'idx_users_active',
        columns: ['active'],
        unique: false,
        where: 'active = true'
    });
    const provider = new FakeProvider('postgresql', [
        { like: /FROM\s+pg_indexes/i, rows: [] }
    ]);
    const gen = new DiffMigrationGenerator_1.DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    const up = steps.map((s) => s.sql).join('\n');
    expect(up).toContain('CREATE INDEX');
    expect(up).toContain('WHERE active = true');
});
test('DiffMigrationGenerator uses MySQL inspector to create missing index (ignores WHERE)', async () => {
    registerUsers({
        name: 'idx_users_active',
        columns: ['active'],
        unique: false,
        where: 'active = 1'
    });
    const provider = new FakeProvider('mysql', [
        { like: /FROM\s+information_schema\.statistics/i, rows: [] }
    ]);
    const gen = new DiffMigrationGenerator_1.DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    const up = steps.map((s) => s.sql).join('\n');
    expect(up).toContain('CREATE INDEX');
    expect(up).not.toContain('WHERE active = 1');
});
test('DiffMigrationGenerator uses MSSQL inspector to create missing filtered index', async () => {
    registerUsers({
        name: 'idx_users_active',
        columns: ['active'],
        unique: false,
        where: 'active = 1'
    });
    const provider = new FakeProvider('mssql', [
        { like: /FROM\s+sys\.indexes/i, rows: [] },
        { like: /FROM\s+sys\.index_columns/i, rows: [] }
    ]);
    const gen = new DiffMigrationGenerator_1.DiffMigrationGenerator(provider);
    const steps = await gen.generate();
    const up = steps.map((s) => s.sql).join('\n');
    expect(up).toContain('CREATE INDEX');
    expect(up).toContain('WHERE active = 1');
});
//# sourceMappingURL=DiffMigrationGenerator.inspectors.test.js.map