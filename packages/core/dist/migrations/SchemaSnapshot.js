"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExpectedSchemaFromMetadata = buildExpectedSchemaFromMetadata;
exports.buildActualSchemaFromProvider = buildActualSchemaFromProvider;
exports.serializeSchemaSnapshot = serializeSchemaSnapshot;
exports.deserializeSchemaSnapshot = deserializeSchemaSnapshot;
const MetadataStorage_1 = require("../metadata/MetadataStorage");
const SchemaInspector_1 = require("./SchemaInspector");
function buildExpectedSchemaFromMetadata() {
    const entities = MetadataStorage_1.MetadataStorage.getEntities();
    const tables = entities.map((entityMeta) => {
        const columns = entityMeta.columns.map((column) => ({
            name: column.columnName,
            type: mapType(column.type),
            nullable: column.nullable,
            defaultValue: column.defaultValue,
            defaultExpression: column.defaultExpression,
            isPrimaryKey: entityMeta.primaryKeys.includes(column.propertyName),
            isComputed: column.isComputed,
            computedExpression: column.computedExpression,
            computedStorage: column.computedStorage
        }));
        const primaryKeys = entityMeta.primaryKeys.map((pk) => entityMeta.columns.find((column) => column.propertyName === pk)?.columnName || pk);
        const indexes = (entityMeta.indexes || []).map((indexDef) => ({
            name: indexDef.name,
            columns: indexDef.columns,
            unique: !!indexDef.unique,
            where: indexDef.where,
            orders: indexDef.orders,
            collations: indexDef.collations,
            nulls: indexDef.nulls,
            expressions: indexDef.expressions,
            using: indexDef.using,
            concurrently: indexDef.concurrently,
            withParams: indexDef.withParams,
            mysqlVisibility: indexDef.mysqlVisibility,
            include: indexDef.include
        }));
        return {
            name: entityMeta.tableName,
            columns,
            primaryKeys,
            indexes,
            foreignKeys: []
        };
    });
    return { tables };
}
async function buildActualSchemaFromProvider(provider, expected) {
    const label = provider.providerLabel || 'sqlite';
    if (label === 'sqlite') {
        const inspector = new SchemaInspector_1.SQLiteSchemaInspector(provider);
        const tableNames = await inspector.listTables();
        const actualTables = [];
        for (const tableName of tableNames) {
            const info = await inspector.getTableInfo(tableName);
            const indexes = await inspector.getIndexes(tableName);
            actualTables.push({
                name: tableName,
                columns: info.columns.map((col) => ({
                    name: col.name,
                    type: normalizeType(col.type),
                    nullable: !col.notnull
                })),
                primaryKeys: info.columns.filter((col) => col.pk > 0).map((col) => col.name),
                indexes: indexes.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique, where: i.where })),
                foreignKeys: []
            });
        }
        return { tables: actualTables };
    }
    // For non-SQLite: mirror expected columns/PKs if provided, and fetch actual indexes.
    const idxFetch = async (table) => {
        if (label === 'postgresql') {
            const ins = new SchemaInspector_1.PostgresSchemaInspector(provider);
            const list = await ins.getIndexes(table);
            return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique, where: i.where }));
        }
        if (label === 'mysql') {
            const ins = new SchemaInspector_1.MySqlSchemaInspector(provider);
            const list = await ins.getIndexes(table);
            return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique }));
        }
        if (label === 'mssql') {
            const ins = new SchemaInspector_1.MssqlSchemaInspector(provider);
            const list = await ins.getIndexes(table);
            return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique, where: i.where }));
        }
        return [];
    };
    const tables = [];
    const source = expected?.tables || [];
    for (const t of source) {
        const indexes = await idxFetch(t.name);
        tables.push({
            name: t.name,
            columns: t.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable })),
            primaryKeys: t.primaryKeys.slice(),
            indexes,
            foreignKeys: []
        });
    }
    return { tables };
}
function serializeSchemaSnapshot(snapshot) {
    return JSON.stringify(snapshot, null, 2);
}
function deserializeSchemaSnapshot(jsonText) {
    const obj = JSON.parse(jsonText);
    // naive validation
    if (!obj || !Array.isArray(obj.tables))
        throw new Error('Invalid SchemaSnapshot JSON');
    return obj;
}
function mapType(type) {
    switch (String(type || '').toUpperCase()) {
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
function normalizeType(type) {
    return mapType(type);
}
//# sourceMappingURL=SchemaSnapshot.js.map