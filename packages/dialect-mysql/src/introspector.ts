import type { DatabaseProvider } from '@ts-linq/core';
import type {
  DatabaseColumnModel,
  DatabaseForeignKeyModel,
  DatabaseIndexModel,
  DatabaseModel,
  DatabaseTableModel,
  DbIntrospector
} from '@ts-linq/types';

function normalizeMySqlType(raw: string): string {
  const t = raw.toLowerCase();
  if (/^tinyint\(1\)/.test(t) || /^bool/.test(t)) return 'BOOLEAN';
  if (/int/.test(t)) return 'INTEGER';
  if (/decimal|numeric/.test(t)) return 'DECIMAL';
  if (/double|float/.test(t)) return 'REAL';
  if (/^json/.test(t)) return 'JSON';
  if (/datetime|timestamp|date|time/.test(t)) return 'DATETIME';
  if (/blob|binary|varbinary/.test(t)) return 'BLOB';
  return 'TEXT';
}

export class MySqlDbIntrospector implements DbIntrospector {
  public constructor(private readonly provider: DatabaseProvider) {}

  public async introspect(schema?: string): Promise<DatabaseModel> {
    const tableNames = await this.listTables();
    const tables: DatabaseTableModel[] = [];
    for (const name of tableNames) {
      const table = await this.introspectTable(name, schema);
      tables.push(table);
    }
    return { tables };
  }

  private async listTables(): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ TABLE_NAME: string }>(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    );
    return rows.map((r) => r.TABLE_NAME);
  }

  private async introspectTable(table: string, schema?: string): Promise<DatabaseTableModel> {
    const columns = await this.getColumns(table);
    const primaryKeys = columns.filter((c) => c.isPrimary).map((c) => c.name);
    const foreignKeys = await this.getForeignKeys(table);
    const indexes = await this.getIndexes(table);
    return { name: table, schema, columns, primaryKeys, foreignKeys, indexes };
  }

  private async getColumns(table: string): Promise<DatabaseColumnModel[]> {
    const rows = await this.provider.executeQuery<{
      COLUMN_NAME: string;
      COLUMN_TYPE: string;
      DATA_TYPE: string;
      IS_NULLABLE: 'YES' | 'NO';
      COLUMN_DEFAULT: string | null;
      EXTRA: string;
    }>(
      `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
       FROM information_schema.columns
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [table]
    );

    const pkRows = await this.provider.executeQuery<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME
       FROM information_schema.columns
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI'
       ORDER BY ORDINAL_POSITION`,
      [table]
    );
    const pkSet = new Set(pkRows.map((r) => r.COLUMN_NAME));

    return rows.map((r) => {
      const rawType = (r.COLUMN_TYPE || r.DATA_TYPE || '').toLowerCase();
      const isIdentity = r.EXTRA.toLowerCase().includes('auto_increment');
      return {
        name: r.COLUMN_NAME,
        dbType: rawType,
        ormType: normalizeMySqlType(rawType),
        nullable: r.IS_NULLABLE === 'YES',
        isPrimary: pkSet.has(r.COLUMN_NAME),
        isIdentity,
        defaultExpression: r.COLUMN_DEFAULT != null && !isIdentity ? r.COLUMN_DEFAULT : undefined
      };
    });
  }

  private async getForeignKeys(table: string): Promise<DatabaseForeignKeyModel[]> {
    const rows = await this.provider.executeQuery<{
      CONSTRAINT_NAME: string;
      COLUMN_NAME: string;
      REFERENCED_TABLE_NAME: string;
      REFERENCED_COLUMN_NAME: string;
      DELETE_RULE: string;
    }>(
      `SELECT
         kcu.CONSTRAINT_NAME,
         kcu.COLUMN_NAME,
         kcu.REFERENCED_TABLE_NAME,
         kcu.REFERENCED_COLUMN_NAME,
         rc.DELETE_RULE
       FROM information_schema.key_column_usage kcu
       JOIN information_schema.referential_constraints rc
         ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
       WHERE kcu.TABLE_SCHEMA = DATABASE() AND kcu.TABLE_NAME = ?
         AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
      [table]
    );

    const byName = new Map<string, DatabaseForeignKeyModel>();
    for (const r of rows) {
      const existing = byName.get(r.CONSTRAINT_NAME);
      if (existing) {
        existing.columns.push(r.COLUMN_NAME);
        existing.referencedColumns.push(r.REFERENCED_COLUMN_NAME);
      } else {
        byName.set(r.CONSTRAINT_NAME, {
          name: r.CONSTRAINT_NAME,
          columns: [r.COLUMN_NAME],
          referencedTable: r.REFERENCED_TABLE_NAME,
          referencedColumns: [r.REFERENCED_COLUMN_NAME],
          onDelete:
            r.DELETE_RULE !== 'NO ACTION' && r.DELETE_RULE !== 'RESTRICT'
              ? r.DELETE_RULE
              : undefined
        });
      }
    }
    return [...byName.values()];
  }

  private async getIndexes(table: string): Promise<DatabaseIndexModel[]> {
    const rows = await this.provider.executeQuery<{
      INDEX_NAME: string;
      NON_UNIQUE: 0 | 1;
      COLUMN_NAME: string | null;
      SEQ_IN_INDEX: number;
      EXPRESSION: string | null;
    }>(
      `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX, EXPRESSION
       FROM information_schema.statistics
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME <> 'PRIMARY'
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [table]
    );

    const byName = new Map<string, DatabaseIndexModel & { _parts: Array<{ col?: string }> }>();
    for (const r of rows) {
      let entry = byName.get(r.INDEX_NAME);
      if (!entry) {
        entry = { name: r.INDEX_NAME, columns: [], unique: r.NON_UNIQUE === 0, _parts: [] };
        byName.set(r.INDEX_NAME, entry);
      }
      if (r.COLUMN_NAME) entry._parts.push({ col: r.COLUMN_NAME });
    }

    return [...byName.values()].map(({ _parts, ...rest }) => ({
      ...rest,
      columns: _parts.filter((p) => p.col != null).map((p) => p.col!)
    }));
  }
}
