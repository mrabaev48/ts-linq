import { SqlHelper } from '@ts-linq/core';
export class MssqlDdlStrategy {
    generateCreateTableSql(metadata) {
        if (!metadata || !metadata.columns) {
            throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
        }
        const columns = metadata.columns.map((column) => this.generateColumnDefinition(column));
        if (metadata.primaryKeys.length > 0) {
            const primaryKeyColumns = metadata.primaryKeys.map((pk) => {
                const col = metadata.columns.find((column) => column.propertyName === pk);
                return col ? col.columnName : pk;
            });
            columns.push(`PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
        }
        return `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '${metadata.tableName}') BEGIN CREATE TABLE ${metadata.tableName} (${columns.join(', ')}) END`;
    }
    generateColumnDefinition(column) {
        let definition = `${column.columnName} ${this.mapTypeToMssql(column.type)}`;
        if (column.length) {
            definition += `(${column.length})`;
        }
        if (!column.nullable) {
            definition += ' NOT NULL';
        }
        if (column.defaultValue !== undefined) {
            definition += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
        }
        return definition;
    }
    generateCreateIndexSql(tableName, index) {
        const unique = index.unique ? 'UNIQUE ' : '';
        return `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${index.name}' AND object_id=OBJECT_ID('${tableName}')) CREATE ${unique}INDEX ${index.name} ON ${tableName} (${index.columns.join(', ')})`;
    }
    mapTypeToMssql(type) {
        switch ((type || '').toUpperCase()) {
            case 'TEXT':
            case 'STRING':
                return 'NVARCHAR(MAX)';
            case 'INTEGER':
            case 'NUMBER':
                return 'INT';
            case 'REAL':
            case 'FLOAT':
            case 'DOUBLE':
                return 'FLOAT';
            case 'BOOLEAN':
                return 'BIT';
            case 'DATETIME':
            case 'DATE':
                return 'DATETIME2';
            case 'BLOB':
                return 'VARBINARY(MAX)';
            case 'UUID':
                return 'UNIQUEIDENTIFIER';
            default:
                return 'NVARCHAR(MAX)';
        }
    }
}
//# sourceMappingURL=MssqlDdlStrategy.js.map