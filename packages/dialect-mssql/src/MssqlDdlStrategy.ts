import { SqlHelper } from '@ts-linq/core';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/types';

type LoggerLike = { warn(message: string, error?: unknown): void };
import { MssqlIndexBuilder } from './builders/MssqlIndexBuilder';
import { quoteIdentifier, quoteStringLiteral } from './quoting';

export class MssqlDdlStrategy {
  private readonly indexBuilder: MssqlIndexBuilder;
  constructor(private readonly logger?: LoggerLike) {
    this.indexBuilder = new MssqlIndexBuilder(logger);
  }
  public generateCreateTableSql(metadata: EntityMetadata): string {
    if (!metadata || !metadata.columns) {
      throw new Error(`Entity metadata is invalid or missing columns: ${JSON.stringify(metadata)}`);
    }
    const columns: string[] = metadata.columns.map((column: ColumnMetadata) =>
      this.generateColumnDefinition(column)
    );
    if (metadata.primaryKeys && metadata.primaryKeys.length > 0) {
      const pkCols = metadata.primaryKeys.map((pk) => {
        const col = metadata.columns.find((column) => column.propertyName === pk);
        return quoteIdentifier(col ? col.columnName : pk);
      });
      columns.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }

    for (const cc of metadata.checkConstraints ?? []) {
      columns.push(`CONSTRAINT ${quoteIdentifier(cc.name)} CHECK (${cc.sql})`);
    }

    return `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = ${quoteStringLiteral(metadata.tableName)}) BEGIN CREATE TABLE ${quoteIdentifier(metadata.tableName)} (${columns.join(', ')}) END`;
  }

  public generateColumnDefinition(column: Omit<ColumnMetadata, 'propertyName'>): string {
    if (column.isComputed && column.computedExpression) {
      const storage = column.computedStorage;
      if (storage && storage !== 'PERSISTED') {
        this.logger?.warn(
          `MSSQL: computedStorage='${storage}' is not supported; use 'PERSISTED' or omit. Applying non-persisted computed for ${column.columnName}`
        );
      }
      const persisted = storage === 'PERSISTED' || storage === 'STORED' ? ' PERSISTED' : '';
      return `${quoteIdentifier(column.columnName)} AS (${column.computedExpression})${persisted}`;
    }
    let sqlType = this.mapTypeToMssql(column.type);
    if (column.length) {
      // Replace (MAX) with the explicit length, or append if no length token present.
      if (sqlType.endsWith('(MAX)')) {
        sqlType = sqlType.slice(0, -5) + `(${column.length})`;
      } else if (!sqlType.includes('(')) {
        sqlType += `(${column.length})`;
      }
    }
    let definition = `${quoteIdentifier(column.columnName)} ${sqlType}`;
    if (column.isGenerated) {
      definition += ' IDENTITY(1,1)';
    }
    if (!column.nullable) definition += ' NOT NULL';
    if ((column as { defaultExpression?: string }).defaultExpression) {
      definition += ` DEFAULT ${(column as { defaultExpression?: string }).defaultExpression}`;
    } else if (column.defaultValue !== undefined) {
      definition += ` DEFAULT ${SqlHelper.formatValue(column.defaultValue)}`;
    }
    return definition;
  }

  public generateCreateIndexSql(
    tableName: string,
    index: {
      name: string;
      columns: string[];
      unique: boolean;
      where?: string;
      orders?: { [column: string]: 'ASC' | 'DESC' };
      include?: string[];
    }
  ): string {
    return this.indexBuilder.buildCreateIndexSql(tableName, index);
  }

  public generateAddColumnSql(
    tableName: string,
    column: Omit<ColumnMetadata, 'propertyName'>
  ): string {
    const colDef = this.generateColumnDefinition(column);
    return `ALTER TABLE ${quoteIdentifier(tableName)} ADD ${colDef}`;
  }

  public generateDropColumnSql(tableName: string, columnName: string): string {
    return `ALTER TABLE ${quoteIdentifier(tableName)} DROP COLUMN ${quoteIdentifier(columnName)}`;
  }

  public generateAlterColumnTypeSql(
    tableName: string,
    columnName: string,
    newType: string
  ): string {
    const colDef = `${quoteIdentifier(columnName)} ${this.mapTypeToMssql(newType)}`;
    return `ALTER TABLE ${quoteIdentifier(tableName)} ALTER COLUMN ${colDef}`;
  }

  public generateRenameTableSql(tableName: string, newTableName: string): string {
    return `EXEC sp_rename ${quoteStringLiteral(tableName)}, ${quoteStringLiteral(newTableName)}`;
  }

  public generateForeignKeySql(
    tableName: string,
    fk: {
      name: string;
      columnName: string;
      relatedTableName: string;
      relatedColumnName: string;
      onDelete?: string;
      onUpdate?: string;
    }
  ): string {
    let sql = `ALTER TABLE ${quoteIdentifier(tableName)} ADD CONSTRAINT ${quoteIdentifier(fk.name)} FOREIGN KEY (${quoteIdentifier(fk.columnName)}) REFERENCES ${quoteIdentifier(fk.relatedTableName)} (${quoteIdentifier(fk.relatedColumnName)})`;
    if (fk.onDelete && fk.onDelete !== 'NO ACTION') {
      sql += ` ON DELETE ${fk.onDelete}`;
    }
    if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') {
      sql += ` ON UPDATE ${fk.onUpdate}`;
    }
    return sql;
  }

  /**
   * Generates `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (...)` for an alternate key.
   * Mirrors EF Core's HasAlternateKey DDL for SQL Server.
   */
  public generateAddUniqueConstraintSql(
    tableName: string,
    name: string,
    columns: string[]
  ): string {
    const cols = columns.map((c) => quoteIdentifier(c)).join(', ');
    return `ALTER TABLE ${quoteIdentifier(tableName)} ADD CONSTRAINT ${quoteIdentifier(name)} UNIQUE (${cols})`;
  }

  /**
   * Generates `ALTER TABLE ... DROP CONSTRAINT ...` for an alternate key.
   */
  public generateDropUniqueConstraintSql(tableName: string, name: string): string {
    return `ALTER TABLE ${quoteIdentifier(tableName)} DROP CONSTRAINT ${quoteIdentifier(name)}`;
  }

  /**
   * Generates sp_addextendedproperty calls for table and column comments.
   * Returns an empty array when neither the table nor any column has a comment.
   */
  public generateCommentSql(entityMetadata: EntityMetadata): string[] {
    const stmts: string[] = [];
    const table = entityMetadata.tableName;
    if (entityMetadata.comment) {
      stmts.push(
        `EXEC sp_addextendedproperty 'MS_Description', N${quoteStringLiteral(entityMetadata.comment)}, 'SCHEMA', N'dbo', 'TABLE', N${quoteStringLiteral(table)}`
      );
    }
    for (const col of entityMetadata.columns) {
      if (col.comment) {
        stmts.push(
          `EXEC sp_addextendedproperty 'MS_Description', N${quoteStringLiteral(col.comment)}, 'SCHEMA', N'dbo', 'TABLE', N${quoteStringLiteral(table)}, 'COLUMN', N${quoteStringLiteral(col.columnName)}`
        );
      }
    }
    return stmts;
  }

  public mapTypeToMssql(type: string): string {
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
      case 'JSON':
      case 'JSONB':
        // SQL Server stores JSON as NVARCHAR(MAX); use a CHECK ISJSON constraint separately.
        return 'NVARCHAR(MAX)';
      default:
        return 'NVARCHAR(MAX)';
    }
  }
}
