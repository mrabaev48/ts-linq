'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MssqlDdlStrategy = void 0;
const core_1 = require('@ts-linq/core');
const MssqlIndexBuilder_1 = require('./builders/MssqlIndexBuilder');
class MssqlDdlStrategy {
  constructor(logger) {
    this.logger = logger;
    this.indexBuilder = new MssqlIndexBuilder_1.MssqlIndexBuilder(logger);
  }
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
        this.logger?.warn(
          `MSSQL: computedStorage='${storage}' is not supported; use 'PERSISTED' or omit. Applying non-persisted computed for ${column.columnName}`
        );
      }
      const persisted = storage === 'PERSISTED' ? ' PERSISTED' : '';
      return `${column.columnName} AS (${column.computedExpression})${persisted}`;
    }
    let definition = `${column.columnName} ${this.mapTypeToMssql(column.type)}`;
    if (column.length) {
      definition += `(${column.length})`;
    }
    if (!column.nullable) definition += ' NOT NULL';
    if (column.defaultExpression) {
      definition += ` DEFAULT ${column.defaultExpression}`;
    } else if (column.defaultValue !== undefined) {
      definition += ` DEFAULT ${core_1.SqlHelper.formatValue(column.defaultValue)}`;
    }
    return definition;
  }
  generateCreateIndexSql(tableName, index) {
    return this.indexBuilder.buildCreateIndexSql(tableName, index);
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
exports.MssqlDdlStrategy = MssqlDdlStrategy;
//# sourceMappingURL=MssqlDdlStrategy.js.map
