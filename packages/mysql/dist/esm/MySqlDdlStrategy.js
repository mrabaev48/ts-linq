import { SqlHelper } from '@ts-linq/core';
export class MySqlDdlStrategy {
    generateCreateTableSql(metadata) {
        if (!metadata || !metadata.columns) {
            throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
        }
        const cols = metadata.columns.map((c) => this.generateColumnDefinition(c));
        if (metadata.primaryKeys.length) {
            const pkCols = metadata.primaryKeys.map((pk) => metadata.columns.find((c) => c.propertyName === pk)?.columnName || pk);
            cols.push(`PRIMARY KEY (${pkCols.join(', ')})`);
        }
        return `CREATE TABLE IF NOT EXISTS ${metadata.tableName} (${cols.join(', ')})`;
    }
    generateCreateIndexSql(table, index) {
        const uniq = index.unique ? 'UNIQUE ' : '';
        return `CREATE ${uniq}INDEX IF NOT EXISTS ${index.name} ON ${table} (${index.columns.join(', ')})`;
    }
    generateColumnDefinition(column) {
        let def = `${column.columnName} ${this.mapTypeToMySql(column.type)}`;
        if (column.length)
            def += `(${column.length})`;
        if (!column.nullable)
            def += ' NOT NULL';
        if (column.defaultValue !== undefined)
            def += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
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
//# sourceMappingURL=MySqlDdlStrategy.js.map