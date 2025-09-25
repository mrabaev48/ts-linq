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
        if (column.isComputed && column.computedExpression) {
            const storage = column.computedStorage;
            if (storage && storage !== 'PERSISTED') {
                console.warn(`MSSQL: computedStorage='${storage}' is not supported; use 'PERSISTED' or omit. Applying non-persisted computed for ${column.columnName}`);
            }
            const persisted = storage === 'PERSISTED' ? ' PERSISTED' : '';
            return `${column.columnName} AS (${column.computedExpression})${persisted}`;
        }
        let definition = `${column.columnName} ${this.mapTypeToMssql(column.type)}`;
        if (column.length) {
            definition += `(${column.length})`;
        }
        if (!column.nullable)
            definition += ' NOT NULL';
        if (column.defaultExpression) {
            definition += ` DEFAULT ${column.defaultExpression}`;
        }
        else if (column.defaultValue !== undefined) {
            definition += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
        }
        return definition;
    }
    generateCreateIndexSql(tableName, index) {
        // MSSQL does not support expression-based columns in simple CREATE INDEX list
        // Warn if caller passed unexpected props via type erasure
        const unexpected = [];
        if (index.expressions)
            unexpected.push('expressions');
        if (index.collations)
            unexpected.push('collations');
        if (index.nulls)
            unexpected.push('nulls');
        if (unexpected.length > 0) {
            console.warn(`MSSQL: unsupported index options ignored for ${index.name}: ${unexpected.join(', ')}`);
        }
        const unique = index.unique ? 'UNIQUE ' : '';
        const whereSql = index.where ? ` WHERE ${index.where}` : '';
        const cols = index.columns.map(c => index.orders?.[c] ? `${c} ${index.orders[c]}` : c).join(', ');
        const include = index.include && index.include.length > 0 ? ` INCLUDE (${index.include.join(', ')})` : '';
        return `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${index.name}' AND object_id=OBJECT_ID('${tableName}')) CREATE ${unique}INDEX ${index.name} ON ${tableName} (${cols})${include}${whereSql}`;
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