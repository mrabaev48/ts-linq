import type { EntityMetadata, ColumnMetadata } from '@ts-linq/types';
import { SqlHelper } from '@ts-linq/core';
import { MySqlIndexBuilder } from './builders/MySqlIndexBuilder';

type LoggerLike = { warn(message: string, error?: unknown): void };

export class MySqlDdlStrategy {
  private readonly indexBuilder: MySqlIndexBuilder;
  constructor(private readonly logger?: LoggerLike) {
    this.indexBuilder = new MySqlIndexBuilder(logger);
  }
  public generateCreateTableSql(metadata: EntityMetadata): string {
    if (!metadata || !metadata.columns) {
      throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
    }
    const cols: string[] = metadata.columns.map((c: any) => this.generateColumnDefinition(c));
    if (metadata.primaryKeys && metadata.primaryKeys.length) {
      const pkCols = metadata.primaryKeys.map(
        (pk: any) => {
           const col = metadata.columns.find((c: any) => c.propertyName === pk);
           return `\`${col?.columnName || pk}\``;
        }
      );
      cols.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }
    return `CREATE TABLE IF NOT EXISTS \`${metadata.tableName}\` (${cols.join(', ')})`;
  }

  public generateCreateIndexSql(
    table: string,
    index: {
      name: string;
      columns: string[];
      unique: boolean;
      where?: string;
      orders?: { [column: string]: 'ASC' | 'DESC' };
      expressions?: string[];
      nulls?: { [column: string]: 'FIRST' | 'LAST' };
      mysqlType?: 'FULLTEXT' | 'SPATIAL';
      mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
    }
  ): string {
    return this.indexBuilder.buildCreateIndexSql(table, index);
  }

  public generateAddColumnSql(tableName: string, column: any): string {
    const colDef = this.generateColumnDefinition(column);
    return `ALTER TABLE \`${tableName}\` ADD COLUMN ${colDef}`;
  }

  public generateDropColumnSql(tableName: string, columnName: string): string {
    return `ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``;
  }

  public generateAlterColumnTypeSql(tableName: string, columnName: string, newType: string): string {
    const colDef = `\`${columnName}\` ${this.mapTypeToMySql(newType)}`;
    return `ALTER TABLE \`${tableName}\` MODIFY COLUMN ${colDef}`;
  }

  public generateRenameTableSql(tableName: string, newTableName: string): string {
    return `ALTER TABLE \`${tableName}\` RENAME TO \`${newTableName}\``;
  }

  public generateForeignKeySql(tableName: string, fk: { 
      name: string, 
      columnName: string, 
      relatedTableName: string, 
      relatedColumnName: string,
      onDelete?: string,
      onUpdate?: string
  }): string {
      let sql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.columnName}\`) REFERENCES \`${fk.relatedTableName}\` (\`${fk.relatedColumnName}\`)`;
      if (fk.onDelete && fk.onDelete !== 'NO ACTION') {
          sql += ` ON DELETE ${fk.onDelete}`;
      }
      if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') {
          sql += ` ON UPDATE ${fk.onUpdate}`;
      }
      return sql;
  }

  public generateColumnDefinition(column: ColumnMetadata): string {
    if (column.isComputed && column.computedExpression) {
      const storage = (column as { computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED' })
        .computedStorage;
      if (storage && storage !== 'STORED' && storage !== 'VIRTUAL') {
        this.logger?.warn(
          `MySQL: computedStorage='${storage}' is not supported (use 'VIRTUAL' or 'STORED'); falling back to VIRTUAL for ${column.columnName}`
        );
      }
      const kind = storage === 'STORED' ? 'STORED' : 'VIRTUAL';
      return `\`${column.columnName}\` ${this.mapTypeToMySql(column.type)} GENERATED ALWAYS AS (${column.computedExpression}) ${kind}`;
    }
    let def = `\`${column.columnName}\` ${this.mapTypeToMySql(column.type)}`;
    if (column.length) def += `(${column.length})`;
    if (!column.nullable) def += ' NOT NULL';
    if ((column as { defaultExpression?: string }).defaultExpression) {
      def += ` DEFAULT ${(column as { defaultExpression?: string }).defaultExpression}`;
    } else if (column.defaultValue !== undefined) {
      def += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
    }
    return def;
  }

  public mapTypeToMySql(type: string): string {
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
