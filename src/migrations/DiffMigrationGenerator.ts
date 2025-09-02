import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SQLiteSchemaInspector } from './SchemaInspector';

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
        const tables = new Set(await inspector.listTables());
        const entities = MetadataStorage.getEntities();

        for (const e of entities) {
            const table = e.tableName;
            if (!tables.has(table)) {
                // Create table using provider DDL path (reuse existing createTable helper)
                steps.push({ sql: this.buildCreateTableSql(e.tableName, e.columns, e.primaryKeys) });
                continue;
            }
            const info = await inspector.getTableInfo(table);
            const existing = new Set(info.columns.map(c => c.name));
            // Detect type/nullability changes → rebuild
            const needsRebuild = e.columns.some(col => {
                const found = info.columns.find(c => c.name === col.columnName);
                if (!found) return false;
                // Ignore PK columns for nullability/type check to avoid false positives with AUTOINCREMENT
                if (Array.isArray(e.primaryKeys) && e.primaryKeys.includes(col.propertyName)) return false;
                const typeChanged = this.mapType(col.type) !== this.normalizeType(found.type);
                const schemaNotNull = Boolean(found.notnull); // true => NOT NULL in DB
                const desiredNotNull = !col.nullable; // true => NOT NULL desired
                const nnChanged = schemaNotNull !== desiredNotNull;
                return typeChanged || nnChanged;
            });
            if (needsRebuild) {
                const temp = `__new_${table}`;
                steps.push({ sql: this.buildCreateTableSql(temp, e.columns, e.primaryKeys) });
                const common = info.columns
                    .map(c => c.name)
                    .filter(n => e.columns.some(col => col.columnName === n));
                if (common.length > 0) {
                    const cols = common.join(', ');
                    steps.push({ sql: `INSERT INTO ${temp} (${cols}) SELECT ${cols} FROM ${table}` });
                }
                steps.push({ sql: `DROP TABLE ${table}` });
                steps.push({ sql: `ALTER TABLE ${temp} RENAME TO ${table}` });
                continue;
            }
            for (const col of e.columns) {
                if (!existing.has(col.columnName)) {
                    const type = this.mapType(col.type);
                    const nn = col.nullable ? '' : ' NOT NULL';
                    const def = col.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(col.defaultValue)}` : '';
                    steps.push({ sql: `ALTER TABLE ${table} ADD COLUMN ${col.columnName} ${type}${nn}${def}` });
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


