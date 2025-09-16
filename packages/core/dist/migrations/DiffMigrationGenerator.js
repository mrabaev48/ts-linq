"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffMigrationGenerator = void 0;
const MetadataStorage_1 = require("../metadata/MetadataStorage");
const SchemaInspector_1 = require("./SchemaInspector");
const DiffTypes_1 = require("./DiffTypes");
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
        const inspector = new SchemaInspector_1.SQLiteSchemaInspector(this.provider);
        const entities = MetadataStorage_1.MetadataStorage.getEntities();
        // Build expected snapshot from metadata
        const expected = {
            tables: entities.map((entityMeta) => {
                const columns = entityMeta.columns.map((column) => ({
                    name: column.columnName,
                    type: this.mapType(column.type),
                    nullable: column.nullable,
                    defaultValue: column.defaultValue,
                    isPrimaryKey: entityMeta.primaryKeys.includes(column.propertyName)
                }));
                const primaryKeys = entityMeta.primaryKeys.map((pk) => entityMeta.columns.find((column) => column.propertyName === pk)?.columnName || pk);
                const indexes = (entityMeta.indexes || []).map((indexDef) => ({
                    name: indexDef.name,
                    columns: indexDef.columns,
                    unique: !!indexDef.unique
                }));
                return {
                    name: entityMeta.tableName,
                    columns,
                    primaryKeys,
                    indexes,
                    foreignKeys: []
                };
            })
        };
        // Build actual snapshot from SQLite
        const tableNames = await inspector.listTables();
        const actualTables = [];
        for (const tableName of tableNames) {
            const info = await inspector.getTableInfo(tableName);
            actualTables.push({
                name: tableName,
                columns: info.columns.map((col) => ({
                    name: col.name,
                    type: this.normalizeType(col.type),
                    nullable: !col.notnull
                })),
                primaryKeys: info.columns.filter((col) => col.pk > 0).map((col) => col.name),
                indexes: [],
                foreignKeys: []
            });
        }
        const actual = { tables: actualTables };
        const diff = (0, DiffTypes_1.compareSchemas)(expected, actual);
        // Translate diff into SQL steps for SQLite
        for (const tableDiff of diff.tables) {
            if (tableDiff.create) {
                steps.push({
                    sql: this.buildCreateTableSql(tableDiff.create.name, tableDiff.create.columns, tableDiff.create.primaryKeys)
                });
                continue;
            }
            if (tableDiff.drop) {
                steps.push({ sql: `DROP TABLE ${tableDiff.table}` });
                continue;
            }
            if (tableDiff.columnChanges && tableDiff.columnChanges.length > 0) {
                // If any alter/drop detected, rebuild table
                const hasDestructive = tableDiff.columnChanges.some((change) => change.kind !== 'add');
                if (hasDestructive) {
                    const entityMeta = entities.find((e) => e.tableName === tableDiff.table);
                    const tempTable = `__new_${tableDiff.table}`;
                    const cols = entityMeta.columns.map((column) => ({
                        name: column.columnName,
                        type: column.type,
                        nullable: column.nullable,
                        defaultValue: column.defaultValue
                    }));
                    const pkCols = entityMeta.primaryKeys.map((pk) => entityMeta.columns.find((column) => column.propertyName === pk)?.columnName || pk);
                    steps.push({ sql: this.buildCreateTableSql(tempTable, cols, pkCols) });
                    const info = await inspector.getTableInfo(tableDiff.table);
                    const commonColumns = info.columns
                        .map((col) => col.name)
                        .filter((columnName) => entityMeta.columns.some((col) => col.columnName === columnName));
                    if (commonColumns.length > 0) {
                        const columnList = commonColumns.join(', ');
                        steps.push({
                            sql: `INSERT INTO ${tempTable} (${columnList}) SELECT ${columnList} FROM ${tableDiff.table}`
                        });
                    }
                    steps.push({ sql: `DROP TABLE ${tableDiff.table}` });
                    steps.push({ sql: `ALTER TABLE ${tempTable} RENAME TO ${tableDiff.table}` });
                    continue;
                }
                // Only adds
                for (const columnChange of tableDiff.columnChanges) {
                    if (columnChange.kind === 'add') {
                        const nn = columnChange.column.nullable ? '' : ' NOT NULL';
                        const def = columnChange.column.defaultValue !== undefined
                            ? ` DEFAULT ${this.formatValue(columnChange.column.defaultValue)}`
                            : '';
                        steps.push({
                            sql: `ALTER TABLE ${tableDiff.table} ADD COLUMN ${columnChange.column.name} ${this.mapType(columnChange.column.type)}${nn}${def}`
                        });
                    }
                }
            }
        }
        // Safety pass for SQLite: ensure simple ADD COLUMNs are emitted for newly added nullable columns
        for (const entity of entities) {
            const info = await inspector.getTableInfo(entity.tableName);
            const existing = new Set(info.columns.map((col) => col.name));
            for (const col of entity.columns) {
                if (!existing.has(col.columnName)) {
                    const nn = col.nullable ? '' : ' NOT NULL';
                    const def = col.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(col.defaultValue)}` : '';
                    const sql = `ALTER TABLE ${entity.tableName} ADD COLUMN ${col.columnName} ${this.mapType(col.type)}${nn}${def}`;
                    if (!steps.some((s) => s.sql.toUpperCase() === sql.toUpperCase())) {
                        steps.push({ sql });
                    }
                }
            }
        }
        return steps;
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