"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySqlDdlStrategy = void 0;
const core_1 = require("@ts-linq/core");
const MySqlIndexBuilder_1 = require("./builders/MySqlIndexBuilder");
class MySqlDdlStrategy {
    constructor(logger) {
        this.logger = logger;
        this.indexBuilder = new MySqlIndexBuilder_1.MySqlIndexBuilder(logger);
    }
    generateCreateTableSql(metadata) {
        if (!metadata || !metadata.columns) {
            throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
        }
        const cols = metadata.columns.map((c) => this.generateColumnDefinition(c));
        if (metadata.primaryKeys && metadata.primaryKeys.length) {
            const pkCols = metadata.primaryKeys.map((pk) => metadata.columns.find((c) => c.propertyName === pk)?.columnName || pk);
            cols.push(`PRIMARY KEY (${pkCols.join(', ')})`);
        }
        return `CREATE TABLE IF NOT EXISTS ${metadata.tableName} (${cols.join(', ')})`;
    }
    generateCreateIndexSql(table, index) {
        return this.indexBuilder.buildCreateIndexSql(table, index);
    }
    generateColumnDefinition(column) {
        if (column.isComputed && column.computedExpression) {
            const storage = column
                .computedStorage;
            if (storage && storage !== 'STORED' && storage !== 'VIRTUAL') {
                this.logger?.warn(`MySQL: computedStorage='${storage}' is not supported (use 'VIRTUAL' or 'STORED'); falling back to VIRTUAL for ${column.columnName}`);
            }
            const kind = storage === 'STORED' ? 'STORED' : 'VIRTUAL';
            return `${column.columnName} ${this.mapTypeToMySql(column.type)} GENERATED ALWAYS AS (${column.computedExpression}) ${kind}`;
        }
        let def = `${column.columnName} ${this.mapTypeToMySql(column.type)}`;
        if (column.length)
            def += `(${column.length})`;
        if (!column.nullable)
            def += ' NOT NULL';
        if (column.defaultExpression) {
            def += ` DEFAULT ${column.defaultExpression}`;
        }
        else if (column.defaultValue !== undefined) {
            def += ` DEFAULT ${core_1.SqlHelper.formatValue(column.defaultValue)}`;
        }
        return def;
    }
    mapTypeToMySql(type) {
        switch ((type || '').toUpperCase()) {
            case 'TEXT':
            case 'STRING':
                return 'TEXT';
            case 'INTEGER':
            case 'NUMBER':
                return 'INT';
            case 'REAL':
            case 'FLOAT':
            case 'DOUBLE':
                return 'DOUBLE';
            case 'BOOLEAN':
                return 'TINYINT(1)';
            case 'DATETIME':
            case 'DATE':
                return 'DATETIME';
            case 'BLOB':
                return 'BLOB';
            default:
                return 'TEXT';
        }
    }
}
exports.MySqlDdlStrategy = MySqlDdlStrategy;
//# sourceMappingURL=MySqlDdlStrategy.js.map