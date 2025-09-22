import type { DatabaseProvider } from '../DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SQLiteSchemaInspector, PostgresSchemaInspector, MySqlSchemaInspector, MssqlSchemaInspector } from './SchemaInspector';
import type { SchemaSnapshot, TableSnapshot, ColumnDef, IndexDef } from './DiffTypes';
import { compareSchemas } from './DiffTypes';
import { generateMigrationFromDiff } from './DialectMigrationSql';

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
    const entities = MetadataStorage.getEntities();
    // Build expected snapshot from metadata
    const expected: SchemaSnapshot = {
      tables: entities.map((entityMeta) => {
        const columns: ColumnDef[] = entityMeta.columns.map((column) => ({
          name: column.columnName,
          type: this.mapType(column.type),
          nullable: column.nullable,
          defaultValue: column.defaultValue,
          isPrimaryKey: entityMeta.primaryKeys.includes(column.propertyName)
        }));
        const primaryKeys = entityMeta.primaryKeys.map(
          (pk) => entityMeta.columns.find((column) => column.propertyName === pk)?.columnName || pk
        );
        const indexes = (entityMeta.indexes || []).map((indexDef) => ({
          name: indexDef.name,
          columns: indexDef.columns,
          unique: !!indexDef.unique,
          where: indexDef.where,
          orders: indexDef.orders,
          collations: indexDef.collations,
          nulls: indexDef.nulls,
          expressions: indexDef.expressions,
          using: (indexDef as { using?: 'btree' | 'hash' | 'gin' | 'gist' }).using,
          concurrently: (indexDef as { concurrently?: boolean }).concurrently,
          withParams: (indexDef as { withParams?: Record<string, string | number | boolean> }).withParams,
          mysqlVisibility: (indexDef as { mysqlVisibility?: 'VISIBLE' | 'INVISIBLE' }).mysqlVisibility,
          include: (indexDef as { include?: string[] }).include
        }));
        return {
          name: entityMeta.tableName,
          columns,
          primaryKeys,
          indexes,
          foreignKeys: []
        } as TableSnapshot;
      })
    };
    // Build actual snapshot depending on provider
    const label = this.provider.providerLabel as 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | string;
    let actual: SchemaSnapshot;
    if (label === 'sqlite') {
      const inspector = new SQLiteSchemaInspector(this.provider);
      const tableNames = await inspector.listTables();
      const actualTables: TableSnapshot[] = [];
      for (const tableName of tableNames) {
        const info = await inspector.getTableInfo(tableName);
        const indexes = await inspector.getIndexes(tableName);
        actualTables.push({
          name: tableName,
          columns: info.columns.map((col) => ({
            name: col.name,
            type: this.normalizeType(col.type),
            nullable: !col.notnull
          })),
          primaryKeys: info.columns.filter((col) => col.pk > 0).map((col) => col.name),
          indexes: indexes.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique, where: i.where })),
          foreignKeys: []
        });
      }
      actual = { tables: actualTables };
    } else {
      // For non-SQLite: mirror expected columns/PKs, but fetch actual indexes via inspectors
      const idxFetch = async (table: string): Promise<IndexDef[]> => {
        if (label === 'postgresql') {
          const ins = new PostgresSchemaInspector(this.provider);
          const list = await ins.getIndexes(table);
          return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique, where: i.where }));
        }
        if (label === 'mysql') {
          const ins = new MySqlSchemaInspector(this.provider);
          const list = await ins.getIndexes(table);
          return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique }));
        }
        if (label === 'mssql') {
          const ins = new MssqlSchemaInspector(this.provider);
          const list = await ins.getIndexes(table);
          return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique, where: i.where }));
        }
        return [];
      };
      const actualTables: TableSnapshot[] = [];
      for (const t of expected.tables) {
        const indexes = await idxFetch(t.name);
        actualTables.push({
          name: t.name,
          columns: t.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable })),
          primaryKeys: t.primaryKeys.slice(),
          indexes,
          foreignKeys: []
        });
      }
      actual = { tables: actualTables };
    }
    const diff = compareSchemas(expected, actual);
    const rendered = generateMigrationFromDiff(diff, label as any);
    return rendered.up.map((sql) => ({ sql }));
  }

  private buildCreateTableSql(table: string, columns: ColumnDef[], primaryKeys: string[]): string {
    const colDefs = columns.map((c) => {
      const type = this.mapType(c.type);
      const nn = c.nullable ? '' : ' NOT NULL';
      const def =
        c.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(c.defaultValue)}` : '';
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
