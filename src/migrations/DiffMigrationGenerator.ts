import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SQLiteSchemaInspector } from './SchemaInspector';
import { SchemaSnapshot, TableSnapshot, compareSchemas } from './DiffTypes';

export interface MigrationStep { sql: string; }

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
            tables: entities.map(e => ({
                name: e.tableName,
                columns: e.columns.map(c => ({ name: c.columnName, type: this.mapType(c.type), nullable: c.nullable, defaultValue: c.defaultValue, isPrimaryKey: e.primaryKeys.includes(c.propertyName) })),
                primaryKeys: e.primaryKeys.map(pk => e.columns.find((c: any) => c.propertyName === pk)?.columnName || pk),
                indexes: e.indexes || [],
                foreignKeys: []
            } as unknown as TableSnapshot))
        };
        // Build actual snapshot from SQLite
        const tableNames = await inspector.listTables();
        const actualTables: TableSnapshot[] = [] as any;
        for (const t of tableNames) {
            const info = await inspector.getTableInfo(t);
            actualTables.push({
                name: t,
                columns: info.columns.map(c => ({ name: c.name, type: this.normalizeType(c.type), nullable: !c.notnull } as any)),
                primaryKeys: info.columns.filter(c => c.pk > 0).map(c => c.name),
                indexes: [],
                foreignKeys: []
            } as any);
        }
        const actual: SchemaSnapshot = { tables: actualTables };
        const diff = compareSchemas(expected, actual);
        // Translate diff into SQL steps for SQLite
        for (const td of diff.tables) {
            if (td.create) {
                steps.push({ sql: this.buildCreateTableSql(td.create.name, td.create.columns as any, td.create.primaryKeys) });
                continue;
            }
            if (td.drop) {
                steps.push({ sql: `DROP TABLE ${td.table}` });
                continue;
            }
            if (td.columnChanges && td.columnChanges.length > 0) {
                // If any alter/drop detected, rebuild table
                const hasDestructive = td.columnChanges.some(c => c.kind !== 'add');
                if (hasDestructive) {
                    const meta = entities.find(e => e.tableName === td.table)!;
                    const temp = `__new_${td.table}`;
                    steps.push({ sql: this.buildCreateTableSql(temp, meta.columns as any, meta.primaryKeys) });
                    const info = await inspector.getTableInfo(td.table);
                    const common = info.columns.map(c => c.name).filter(n => meta.columns.some(col => col.columnName === n));
                    if (common.length > 0) {
                        const cols = common.join(', ');
                        steps.push({ sql: `INSERT INTO ${temp} (${cols}) SELECT ${cols} FROM ${td.table}` });
                    }
                    steps.push({ sql: `DROP TABLE ${td.table}` });
                    steps.push({ sql: `ALTER TABLE ${temp} RENAME TO ${td.table}` });
                    continue;
                }
                // Only adds
                for (const c of td.columnChanges) {
                    if (c.kind === 'add') {
                        const nn = c.column.nullable ? '' : ' NOT NULL';
                        const def = c.column.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(c.column.defaultValue)}` : '';
                        steps.push({ sql: `ALTER TABLE ${td.table} ADD COLUMN ${c.column.name} ${this.mapType(c.column.type)}${nn}${def}` });
                    }
                }
            }
        }
        // Safety pass for SQLite: ensure simple ADD COLUMNs are emitted for newly added nullable columns
        for (const e of entities) {
            const info = await inspector.getTableInfo(e.tableName);
            const existing = new Set(info.columns.map(c => c.name));
            for (const col of e.columns) {
                if (!existing.has(col.columnName)) {
                    const nn = col.nullable ? '' : ' NOT NULL';
                    const def = col.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(col.defaultValue)}` : '';
                    const sql = `ALTER TABLE ${e.tableName} ADD COLUMN ${col.columnName} ${this.mapType(col.type)}${nn}${def}`;
                    if (!steps.some(s => s.sql.toUpperCase() === sql.toUpperCase())) {
                        steps.push({ sql });
                    }
                }
            }
        }
        return steps;
    }

    private buildCreateTableSql(table: string, columns: any[], primaryKeys: string[]): string {
        const colDefs = columns.map(c => {
            const type = this.mapType(c.type);
            const nn = c.nullable ? '' : ' NOT NULL';
            const def = c.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(c.defaultValue)}` : '';
            return `${c.columnName} ${type}${nn}${def}`;
        });
        if (Array.isArray(primaryKeys) && primaryKeys.length > 0) {
            const pkCols = primaryKeys.map(pk => columns.find((c: any) => c.propertyName === pk)?.columnName || pk);
            colDefs.push(`PRIMARY KEY (${pkCols.join(', ')})`);
        }
        return `CREATE TABLE IF NOT EXISTS ${table} (${colDefs.join(', ')})`;
    }

    private mapType(type: string): string {
        switch (type.toUpperCase()) {
            case 'INTEGER': case 'NUMBER': return 'INTEGER';
            case 'REAL': case 'FLOAT': case 'DOUBLE': return 'REAL';
            case 'BOOLEAN': return 'INTEGER';
            case 'DATETIME': case 'DATE': return 'TEXT';
            case 'BLOB': return 'BLOB';
            default: return 'TEXT';
        }
    }

    private normalizeType(type: string): string { return this.mapType(type); }

    private formatValue(v: any): string {
        if (v === null) return 'NULL';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'boolean') return v ? '1' : '0';
        if (v instanceof Date) return `'${v.toISOString()}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
    }
}


