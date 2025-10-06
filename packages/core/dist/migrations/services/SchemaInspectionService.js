'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SchemaInspectionService = void 0;
const SchemaInspector_1 = require('../SchemaInspector');
class SchemaInspectionService {
  async buildActualSnapshot(provider, expected) {
    const label = provider.providerLabel;
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
      return { tables: actualTables };
    }
    // For non-SQLite: mirror expected columns/PKs, fetch actual indexes via dialect inspectors
    const fetchIndexes = async (table) => {
      if (label === 'postgresql') {
        const ins = new SchemaInspector_1.PostgresSchemaInspector(provider);
        const list = await ins.getIndexes(table);
        return list.map((i) => ({
          name: i.name,
          columns: i.columns,
          unique: i.unique,
          where: i.where
        }));
      }
      if (label === 'mysql') {
        const ins = new SchemaInspector_1.MySqlSchemaInspector(provider);
        const list = await ins.getIndexes(table);
        return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique }));
      }
      if (label === 'mssql') {
        const ins = new SchemaInspector_1.MssqlSchemaInspector(provider);
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
      const indexes = await fetchIndexes(t.name);
      actualTables.push({
        name: t.name,
        columns: t.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable })),
        primaryKeys: t.primaryKeys.slice(),
        indexes,
        foreignKeys: []
      });
    }
    return { tables: actualTables };
  }
  normalizeType(type) {
    switch (type?.toUpperCase()) {
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
}
exports.SchemaInspectionService = SchemaInspectionService;
//# sourceMappingURL=SchemaInspectionService.js.map
