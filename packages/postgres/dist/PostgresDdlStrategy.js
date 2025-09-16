"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDdlStrategy = void 0;
class PostgresDdlStrategy {
    generateCreateTableSql(entityMetadata) {
        const columnSqls = entityMetadata.columns.map((column) => {
            const mappedType = this.mapTypeToPg(column.type);
            const notNullSql = column.nullable ? '' : ' NOT NULL';
            return `"${column.columnName}" ${mappedType}${notNullSql}`;
        });
        if (entityMetadata.primaryKeys.length > 0) {
            const primaryKeySql = entityMetadata.primaryKeys
                .map((primaryKey) => `"${entityMetadata.columns.find((column) => column.propertyName === primaryKey)?.columnName || primaryKey}"`)
                .join(', ');
            columnSqls.push(`PRIMARY KEY (${primaryKeySql})`);
        }
        return `CREATE TABLE IF NOT EXISTS "${entityMetadata.tableName}" (${columnSqls.join(', ')})`;
    }
    generateCreateIndexSql(table, index) {
        const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
        const columnsListSql = index.columns.map((column) => `"${column}"`).join(', ');
        return `CREATE ${uniqueKeyword}INDEX IF NOT EXISTS "${index.name}" ON "${table}" (${columnsListSql})`;
    }
    mapTypeToPg(type) {
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
                return 'DOUBLE PRECISION';
            case 'BOOLEAN':
                return 'BOOLEAN';
            case 'DATETIME':
            case 'DATE':
                return 'TIMESTAMPTZ';
            case 'BLOB':
                return 'BYTEA';
            case 'UUID':
                return 'UUID';
            case 'JSONB':
                return 'JSONB';
            case 'JSON':
                return 'JSON';
            default:
                return 'TEXT';
        }
    }
}
exports.PostgresDdlStrategy = PostgresDdlStrategy;
//# sourceMappingURL=PostgresDdlStrategy.js.map