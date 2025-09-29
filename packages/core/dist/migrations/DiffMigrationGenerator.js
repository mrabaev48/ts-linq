"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffMigrationGenerator = void 0;
const SchemaSnapshot_1 = require("./SchemaSnapshot");
const SchemaInspector_1 = require("./SchemaInspector");
const DiffTypes_1 = require("./DiffTypes");
const DialectMigrationSql_1 = require("./DialectMigrationSql");
/**
 * Minimal diff generator (SQLite):
 * - Create table if missing
 * - Add missing non-nullable columns with default (when possible)
 *
 * Note: For complex ALTERs SQLite often requires table rebuild; here we handle simple adds.
 */
class DiffMigrationGenerator {
    constructor(provider) {
        this.provider = provider;
    }
    async generate() {
        const steps = [];
        const expected = new SchemaSnapshot_1.SchemaSnapshotBuilder().buildExpectedFromMetadata();
        // Build actual snapshot depending on provider
        const label = this.provider.providerLabel;
        let actual;
        if (label === 'sqlite') {
            const inspector = new SchemaInspector_1.SQLiteSchemaInspector(this.provider);
            const tableNames = await inspector.listTables();
            const actualTables = [];
            for (const tableName of tableNames) {
                const info = await inspector.getTableInfo(tableName);
                const indexes = await inspector.getIndexes(tableName);
                actualTables.push({
                    name: tableName,
                    columns: info.columns.map((col) => ({
                        name: col.name,
                        type: this.normalizeType(col.type),
                        nullable: !col.notnull
                    })),
                    primaryKeys: info.columns.filter((col) => col.pk > 0).map((col) => col.name),
                    indexes: indexes.map((i) => ({
                        name: i.name,
                        columns: i.columns,
                        unique: i.unique,
                        where: i.where
                    })),
                    foreignKeys: []
                });
            }
            actual = { tables: actualTables };
        }
        else {
            // For non-SQLite: mirror expected columns/PKs, but fetch actual indexes via inspectors
            const idxFetch = async (table) => {
                if (label === 'postgresql') {
                    const ins = new SchemaInspector_1.PostgresSchemaInspector(this.provider);
                    const list = await ins.getIndexes(table);
                    return list.map((i) => ({
                        name: i.name,
                        columns: i.columns,
                        unique: i.unique,
                        where: i.where
                    }));
                }
                if (label === 'mysql') {
                    const ins = new SchemaInspector_1.MySqlSchemaInspector(this.provider);
                    const list = await ins.getIndexes(table);
                    return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique }));
                }
                if (label === 'mssql') {
                    const ins = new SchemaInspector_1.MssqlSchemaInspector(this.provider);
                    const list = await ins.getIndexes(table);
                    return list.map((i) => ({
                        name: i.name,
                        columns: i.columns,
                        unique: i.unique,
                        where: i.where
                    }));
                }
                return [];
            };
            const actualTables = [];
            for (const t of expected.tables) {
                const indexes = await idxFetch(t.name);
                actualTables.push({
                    name: t.name,
                    columns: t.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable })),
                    primaryKeys: t.primaryKeys.slice(),
                    indexes,
                    foreignKeys: []
                });
            }
            actual = { tables: actualTables };
        }
        const diff = (0, DiffTypes_1.compareSchemas)(expected, actual);
        const rendered = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, label);
        return rendered.up.map((sql) => ({ sql }));
    }
    buildCreateTableSql(table, columns, primaryKeys) {
        const colDefs = columns.map((c) => {
            const type = this.mapType(c.type);
            const nn = c.nullable ? '' : ' NOT NULL';
            const def = c.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(c.defaultValue)}` : '';
            const colName = c.name;
            return `${colName} ${type}${nn}${def}`;
        });
        if (Array.isArray(primaryKeys) && primaryKeys.length > 0) {
            colDefs.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
        }
        return `CREATE TABLE IF NOT EXISTS ${table} (${colDefs.join(', ')})`;
    }
    mapType(type) {
        switch (type.toUpperCase()) {
            case 'INTEGER':
            case 'NUMBER':
                return 'INTEGER';
            case 'REAL':
            case 'FLOAT':
            case 'DOUBLE':
                return 'REAL';
            case 'BOOLEAN':
                return 'INTEGER';
            case 'DATETIME':
            case 'DATE':
                return 'TEXT';
            case 'BLOB':
                return 'BLOB';
            default:
                return 'TEXT';
        }
    }
    normalizeType(type) {
        return this.mapType(type);
    }
    formatValue(v) {
        if (v === null)
            return 'NULL';
        if (typeof v === 'number')
            return String(v);
        if (typeof v === 'boolean')
            return v ? '1' : '0';
        if (v instanceof Date)
            return `'${v.toISOString()}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
    }
}
exports.DiffMigrationGenerator = DiffMigrationGenerator;
//# sourceMappingURL=DiffMigrationGenerator.js.map