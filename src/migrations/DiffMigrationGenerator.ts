import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SQLiteSchemaInspector } from './SchemaInspector';
import { SchemaSnapshot, TableSnapshot, compareSchemas, ColumnDef } from './DiffTypes';

export interface MigrationStep {
  sql: string;
}

/**
 * Minimal diff generator (SQLite):
 * - Create table if missing
 * - Add missing non-nullable columns with default (when possible)
 *
 * Note: For complex ALTERs SQLite often requires table rebuild; here we handle simple adds.
 */
export class DiffMigrationGenerator {
  constructor(private provider: DatabaseProvider) {}

  public async generate(): Promise<MigrationStep[]> {
    const steps: MigrationStep[] = [];
    const inspector = new SQLiteSchemaInspector(this.provider);
    const entities = MetadataStorage.getEntities();
    // Build expected snapshot from metadata
    const expected: SchemaSnapshot = {
      tables: entities.map((e) => {
        const columns: ColumnDef[] = e.columns.map((c) => ({
          name: c.columnName,
          type: this.mapType(c.type),
          nullable: c.nullable,
          defaultValue: c.defaultValue,
          isPrimaryKey: e.primaryKeys.includes(c.propertyName)
        }));
        const primaryKeys = e.primaryKeys.map(
          (pk) => e.columns.find((c) => c.propertyName === pk)?.columnName || pk
        );
        const indexes = (e.indexes || []).map((i) => ({
          name: i.name,
          columns: i.columns,
          unique: !!i.unique
        }));
        return {
          name: e.tableName,
          columns,
          primaryKeys,
          indexes,
          foreignKeys: []
        } as TableSnapshot;
      })
    };
    // Build actual snapshot from SQLite
    const tableNames = await inspector.listTables();
    const actualTables: TableSnapshot[] = [];
    for (const tableName of tableNames) {
      const info = await inspector.getTableInfo(tableName);
      actualTables.push({
        name: tableName,
        columns: info.columns.map((c) => ({ name: c.name, type: this.normalizeType(c.type), nullable: !c.notnull })),
        primaryKeys: info.columns.filter((c) => c.pk > 0).map((c) => c.name),
        indexes: [],
        foreignKeys: []
      });
    }
    const actual: SchemaSnapshot = { tables: actualTables };
    const diff = compareSchemas(expected, actual);
    // Translate diff into SQL steps for SQLite
    for (const td of diff.tables) {
      if (td.create) {
        steps.push({
          sql: this.buildCreateTableSql(td.create.name, td.create.columns, td.create.primaryKeys)
        });
        continue;
      }
      if (td.drop) {
        steps.push({ sql: `DROP TABLE ${td.table}` });
        continue;
      }
      if (td.columnChanges && td.columnChanges.length > 0) {
        // If any alter/drop detected, rebuild table
        const hasDestructive = td.columnChanges.some((change) => change.kind !== 'add');
        if (hasDestructive) {
          const meta = entities.find((e) => e.tableName === td.table)!;
          const temp = `__new_${td.table}`;
          const cols: ColumnDef[] = meta.columns.map((c) => ({
            name: c.columnName,
            type: c.type,
            nullable: c.nullable,
            defaultValue: c.defaultValue
          }));
          const pkCols = meta.primaryKeys.map(
            (pk) => meta.columns.find((c) => c.propertyName === pk)?.columnName || pk
          );
          steps.push({ sql: this.buildCreateTableSql(temp, cols, pkCols) });
          const info = await inspector.getTableInfo(td.table);
          const commonColumns = info.columns
            .map((c) => c.name)
            .filter((n) => meta.columns.some((col) => col.columnName === n));
          if (commonColumns.length > 0) {
            const cols = commonColumns.join(', ');
            steps.push({ sql: `INSERT INTO ${temp} (${cols}) SELECT ${cols} FROM ${td.table}` });
          }
          steps.push({ sql: `DROP TABLE ${td.table}` });
          steps.push({ sql: `ALTER TABLE ${temp} RENAME TO ${td.table}` });
          continue;
        }
        // Only adds
        for (const columnChange of td.columnChanges) {
          if (columnChange.kind === 'add') {
            const nn = columnChange.column.nullable ? '' : ' NOT NULL';
            const def =
              columnChange.column.defaultValue !== undefined
                ? ` DEFAULT ${this.formatValue(columnChange.column.defaultValue)}`
                : '';
            steps.push({
              sql: `ALTER TABLE ${td.table} ADD COLUMN ${columnChange.column.name} ${this.mapType(columnChange.column.type)}${nn}${def}`
            });
          }
        }
      }
    }
    // Safety pass for SQLite: ensure simple ADD COLUMNs are emitted for newly added nullable columns
    for (const entity of entities) {
      const info = await inspector.getTableInfo(entity.tableName);
      const existing = new Set(info.columns.map((c) => c.name));
      for (const col of entity.columns) {
        if (!existing.has(col.columnName)) {
          const nn = col.nullable ? '' : ' NOT NULL';
          const def =
            col.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(col.defaultValue)}` : '';
          const sql = `ALTER TABLE ${entity.tableName} ADD COLUMN ${col.columnName} ${this.mapType(col.type)}${nn}${def}`;
          if (!steps.some((s) => s.sql.toUpperCase() === sql.toUpperCase())) {
            steps.push({ sql });
          }
        }
      }
    }
    return steps;
  }

  private buildCreateTableSql(
    table: string,
    columns: ColumnDef[],
    primaryKeys: string[]
  ): string {
    const colDefs = columns.map((c) => {
      const type = this.mapType(c.type);
      const nn = c.nullable ? '' : ' NOT NULL';
      const def = c.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(c.defaultValue)}` : '';
      const colName = c.name;
      return `${colName} ${type}${nn}${def}`;
    });
    if (Array.isArray(primaryKeys) && primaryKeys.length > 0) {
      colDefs.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
    }
    return `CREATE TABLE IF NOT EXISTS ${table} (${colDefs.join(', ')})`;
  }

  private mapType(type: string): string {
    switch (type.toUpperCase()) {
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

  private normalizeType(type: string): string {
    return this.mapType(type);
  }

  private formatValue(v: unknown): string {
    if (v === null) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v instanceof Date) return `'${v.toISOString()}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  }
}
