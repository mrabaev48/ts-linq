import type { DatabaseProvider } from '@ts-linq/core';
import type {
  DatabaseColumnModel,
  DatabaseForeignKeyModel,
  DatabaseIndexModel,
  DatabaseModel,
  DatabaseTableModel,
  DbIntrospector
} from '@ts-linq/types';

function normalizePostgresType(raw: string): string {
  const t = raw.toLowerCase();
  if (/(?:small|big)?int|serial|bigserial/.test(t)) return 'INTEGER';
  if (/numeric|decimal/.test(t)) return 'DECIMAL';
  if (/double|real/.test(t)) return 'REAL';
  if (/uuid/.test(t)) return 'UUID';
  if (/jsonb/.test(t)) return 'JSONB';
  if (/json/.test(t)) return 'JSON';
  if (/timestamp|timestamptz|date|time/.test(t)) return 'DATETIME';
  if (/bool/.test(t)) return 'BOOLEAN';
  if (/bytea/.test(t)) return 'BLOB';
  return 'TEXT';
}

export class PostgresDbIntrospector implements DbIntrospector {
  public constructor(private readonly provider: DatabaseProvider) {}

  public async introspect(schema?: string): Promise<DatabaseModel> {
    const sch = schema ?? 'public';
    const tableNames = await this.listTables(sch);
    const tables: DatabaseTableModel[] = [];
    for (const name of tableNames) {
      const table = await this.introspectTable(name, sch);
      tables.push(table);
    }
    return { tables };
  }

  private async listTables(schema: string): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ tablename: string }>(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename',
      [schema]
    );
    return rows.map((r) => r.tablename);
  }

  private async introspectTable(table: string, schema: string): Promise<DatabaseTableModel> {
    const columns = await this.getColumns(table, schema);
    const primaryKeys = columns.filter((c) => c.isPrimary).map((c) => c.name);
    const foreignKeys = await this.getForeignKeys(table, schema);
    const indexes = await this.getIndexes(table, schema);
    return { name: table, schema, columns, primaryKeys, foreignKeys, indexes };
  }

  private async getColumns(table: string, schema: string): Promise<DatabaseColumnModel[]> {
    const rows = await this.provider.executeQuery<{
      column_name: string;
      udt_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
      column_default: string | null;
    }>(
      `SELECT column_name, udt_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table]
    );

    const pkRows = await this.provider.executeQuery<{ column_name: string }>(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.ordinal_position`,
      [schema, table]
    );
    const pkSet = new Set(pkRows.map((r) => r.column_name));

    return rows.map((r) => {
      const rawType = (r.udt_name || r.data_type || '').toLowerCase();
      const isIdentity =
        r.column_default != null &&
        (r.column_default.startsWith('nextval(') ||
          r.column_default.toLowerCase().includes('serial'));
      return {
        name: r.column_name,
        dbType: rawType,
        ormType: normalizePostgresType(rawType),
        nullable: r.is_nullable === 'YES',
        isPrimary: pkSet.has(r.column_name),
        isIdentity,
        defaultExpression: r.column_default != null && !isIdentity ? r.column_default : undefined
      };
    });
  }

  private async getForeignKeys(table: string, schema: string): Promise<DatabaseForeignKeyModel[]> {
    const rows = await this.provider.executeQuery<{
      constraint_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
      delete_rule: string;
    }>(
      `SELECT
         rc.constraint_name,
         kcu.column_name,
         ccu.table_name AS foreign_table_name,
         ccu.column_name AS foreign_column_name,
         rc.delete_rule
       FROM information_schema.referential_constraints rc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = rc.constraint_name
        AND kcu.constraint_schema = rc.constraint_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = rc.unique_constraint_name
        AND ccu.constraint_schema = rc.unique_constraint_schema
       WHERE kcu.table_schema = $1 AND kcu.table_name = $2
       ORDER BY rc.constraint_name, kcu.ordinal_position`,
      [schema, table]
    );

    const byName = new Map<string, DatabaseForeignKeyModel>();
    for (const r of rows) {
      const existing = byName.get(r.constraint_name);
      if (existing) {
        existing.columns.push(r.column_name);
        existing.referencedColumns.push(r.foreign_column_name);
      } else {
        byName.set(r.constraint_name, {
          name: r.constraint_name,
          columns: [r.column_name],
          referencedTable: r.foreign_table_name,
          referencedColumns: [r.foreign_column_name],
          onDelete: r.delete_rule !== 'NO ACTION' ? r.delete_rule : undefined
        });
      }
    }
    return [...byName.values()];
  }

  private async getIndexes(table: string, schema: string): Promise<DatabaseIndexModel[]> {
    const rows = await this.provider.executeQuery<{ indexname: string; indexdef: string }>(
      'SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = $2',
      [schema, table]
    );
    const result: DatabaseIndexModel[] = [];
    for (const r of rows) {
      if (r.indexname.endsWith('_pkey')) continue;
      const def = r.indexdef || '';
      const unique = /^CREATE\s+UNIQUE\s+INDEX/i.test(def);
      const match = /ON\s+[^()]+\((.+?)\)(?:\s+WHERE\s+(.+))?$/i.exec(def);
      const list = match?.[1] ?? '';
      const where = match?.[2] ?? undefined;
      const columns: string[] = [];
      for (const part of list.split(',').map((s) => s.trim())) {
        if (part.startsWith('(')) continue;
        const col = part.replace(/^"|"$/g, '').replace(/\s+(ASC|DESC)$/i, '');
        columns.push(col);
      }
      if (columns.length > 0) result.push({ name: r.indexname, columns, unique, where });
    }
    return result;
  }
}
