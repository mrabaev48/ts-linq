import { PgIndexBuilder } from './builders/PgIndexBuilder';
export class PostgresDdlStrategy {
    constructor(logger) {
        this.logger = logger;
        this.indexBuilder = new PgIndexBuilder(logger);
    }
    generateCreateTableSql(entityMetadata) {
        const columnSqls = entityMetadata.columns.map((column) => {
            if (column.isComputed && column.computedExpression) {
                const storage = column
                    .computedStorage;
                if (storage && storage !== 'STORED') {
                    this.logger?.warn(`Postgres: computedStorage='${storage}' is not supported; coercing to STORED for ${column.columnName}`);
                }
                return `"${column.columnName}" ${this.mapTypeToPg(column.type)} GENERATED ALWAYS AS (${column.computedExpression}) STORED`;
            }
            const mappedType = this.mapTypeToPg(column.type);
            const notNullSql = column.nullable ? '' : ' NOT NULL';
            const defaultSql = column.defaultExpression ? ` DEFAULT ${column.defaultExpression}` : '';
            return `"${column.columnName}" ${mappedType}${notNullSql}${defaultSql}`;
        });
        if (entityMetadata.primaryKeys.length > 0) {
            const primaryKeySql = entityMetadata.primaryKeys
                .map((primaryKey) => `"${entityMetadata.columns.find((column) => column.propertyName === primaryKey)
                ?.columnName || primaryKey}"`)
                .join(', ');
            columnSqls.push(`PRIMARY KEY (${primaryKeySql})`);
        }
        return `CREATE TABLE IF NOT EXISTS "${entityMetadata.tableName}" (${columnSqls.join(', ')})`;
    }
    generateCreateIndexSql(table, index) {
        return this.indexBuilder.buildCreateIndexSql(table, index);
    }
    mapTypeToPg(type) {
        const key = (type || '').toUpperCase();
        const map = {
            TEXT: 'TEXT',
            STRING: 'TEXT',
            INTEGER: 'INTEGER',
            NUMBER: 'INTEGER',
            REAL: 'DOUBLE PRECISION',
            FLOAT: 'DOUBLE PRECISION',
            DOUBLE: 'DOUBLE PRECISION',
            BOOLEAN: 'BOOLEAN',
            DATETIME: 'TIMESTAMPTZ',
            DATE: 'TIMESTAMPTZ',
            BLOB: 'BYTEA',
            UUID: 'UUID',
            JSONB: 'JSONB',
            JSON: 'JSON'
        };
        return map[key] ?? 'TEXT';
    }
}
//# sourceMappingURL=PostgresDdlStrategy.js.map