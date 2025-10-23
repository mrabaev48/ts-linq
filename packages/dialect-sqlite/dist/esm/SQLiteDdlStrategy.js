import { SqlHelper } from '@ts-linq/core';
import { SQLiteIndexBuilder } from './builders/SQLiteIndexBuilder';
export class SQLiteDdlStrategy {
    constructor(logger) {
        this.logger = logger;
        this.indexBuilder = new SQLiteIndexBuilder(logger);
    }
    generateCreateTableSql(metadata) {
        if (!metadata || !metadata.columns) {
            throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
        }
        const columns = metadata.columns.map((col) => this.generateColumnDefinition(col));
        if (metadata.primaryKeys && metadata.primaryKeys.length > 0) {
            const primaryKeyColumns = metadata.primaryKeys.map((pk) => {
                const column = metadata.columns.find((c) => c.propertyName === pk);
                return column ? column.columnName : pk;
            });
            // Special handling for SQLite AUTOINCREMENT
            if (metadata.primaryKeys.length === 1) {
                const pkColumn = metadata.columns.find((c) => c.propertyName === metadata.primaryKeys[0]);
                if (pkColumn && pkColumn.isGenerated && this.mapTypeToSQLite(pkColumn.type) === 'INTEGER') {
                    const pkIndex = metadata.columns.findIndex((c) => c.propertyName === metadata.primaryKeys[0]);
                    columns[pkIndex] += ' PRIMARY KEY AUTOINCREMENT';
                }
                else {
                    columns.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
                }
            }
            else {
                columns.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
            }
        }
        return `CREATE TABLE IF NOT EXISTS ${metadata.tableName} (${columns.join(', ')})`;
    }
    generateCreateIndexSql(tableName, index) {
        return this.indexBuilder.buildCreateIndexSql(tableName, index);
    }
    generateColumnDefinition(column) {
        if (column.isComputed && column.computedExpression) {
            const storage = column
                .computedStorage;
            const kind = storage === 'STORED' ? 'STORED' : 'VIRTUAL';
            if (storage && storage !== 'STORED' && storage !== 'VIRTUAL') {
                this.logger?.warn(`SQLite: computedStorage='${storage}' is not supported (use 'VIRTUAL' or 'STORED'); using ${kind} for ${column.columnName}`);
            }
            if (kind === 'STORED') {
                this.logger?.warn(`SQLite: STORED generated columns require SQLite >= 3.31; falling back to VIRTUAL for ${column.columnName}`);
            }
            return `${column.columnName} GENERATED ALWAYS AS (${column.computedExpression}) ${kind}`;
        }
        let definition = `${column.columnName} ${this.mapTypeToSQLite(column.type)}`;
        if (column.length) {
            definition += `(${column.length})`;
        }
        const isIntegerAutoincPk = column.isGenerated && this.mapTypeToSQLite(column.type) === 'INTEGER';
        if (!isIntegerAutoincPk) {
            if (!column.nullable) {
                definition += ' NOT NULL';
            }
            const defExpr = column.defaultExpression;
            if (defExpr) {
                definition += ` DEFAULT ${defExpr}`;
            }
            else if (column.defaultValue !== undefined) {
                definition += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
            }
        }
        return definition;
    }
    mapTypeToSQLite(type) {
        switch ((type || '').toUpperCase()) {
            case 'TEXT':
            case 'STRING':
                return 'TEXT';
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
//# sourceMappingURL=SQLiteDdlStrategy.js.map