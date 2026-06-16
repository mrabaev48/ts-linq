import type { DatabaseProvider } from '@ts-linq/core';
import { UnsupportedOperationError } from '@ts-linq/types';

export interface TableIndexDef {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
}

/**
 * Dialect-agnostic contract for reading an existing database schema.
 *
 * The concrete per-dialect inspectors implement this; callers depend on the
 * interface (not the concrete classes) and obtain an instance via
 * {@link SchemaInspectorFactory.for}.
 */
export interface SchemaInspector {
  /** List the user tables present in the connected database. */
  listTables(): Promise<string[]>;
  /** List the user-declared (non-primary-key) indexes for a table. */
  getIndexes(table: string): Promise<TableIndexDef[]>;
}

/** PostgreSQL schema inspector using pg_catalog views. */
export class PostgresSchemaInspector implements SchemaInspector {
  constructor(private provider: DatabaseProvider) {}

  public async listTables(): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY tablename"
    );
    return rows.map((r) => r.tablename);
  }

  public async getIndexes(table: string): Promise<TableIndexDef[]> {
    const rows = await this.provider.executeQuery<{ indexname: string; indexdef: string }>(
      'SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1',
      [table]
    );
    const result: TableIndexDef[] = [];
    for (const r of rows) {
      // Ignore implicit primary key index created by PRIMARY KEY constraint.
      // It is not user-declared and should not participate in schema diff.
      if (r.indexname.endsWith('_pkey')) continue;
      const def = r.indexdef || '';
      const unique = /^CREATE\s+UNIQUE\s+INDEX/i.test(def);
      // Extract parts inside parentheses after ON <table> (...). Table may be schema-qualified with quoted identifiers.
      const match = /ON\s+[^()]+\((.+?)\)(?:\s+WHERE\s+(.+))?$/i.exec(def);
      const list = match?.[1] || '';
      const where = match?.[2] || undefined;
      const parts = list.split(',').map((s) => s.trim());
      const columns: string[] = [];
      for (const p of parts) {
        // p like '"col" ASC' or '(LOWER(col))'
        if (p.startsWith('(')) {
          // expression: skip from columns list for portability in diff
          continue;
        }
        const cleaned = p.replace(/^"|"$/g, '').replace(/\s+(ASC|DESC)$/i, '');
        columns.push(cleaned);
      }
      result.push({ name: r.indexname, columns, unique, where });
    }
    return result;
  }
}

/** MySQL schema inspector using information_schema.statistics. */
export class MySqlSchemaInspector implements SchemaInspector {
  constructor(private provider: DatabaseProvider) {}

  public async listTables(): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ TABLE_NAME: string }>(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    );
    return rows.map((r) => r.TABLE_NAME);
  }

  public async getIndexes(table: string): Promise<TableIndexDef[]> {
    const rows = await this.provider.executeQuery<{
      INDEX_NAME: string;
      NON_UNIQUE: 0 | 1;
      COLUMN_NAME: string | null;
      SEQ_IN_INDEX: number;
      COLLATION?: 'A' | 'D' | null;
      EXPRESSION?: string | null;
    }>(
      // Exclude PRIMARY — it is tracked via primaryKeys, not as an explicit index.
      "SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX, COLLATION, EXPRESSION FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME <> 'PRIMARY' ORDER BY INDEX_NAME, SEQ_IN_INDEX",
      [table]
    );
    const byName = new Map<
      string,
      TableIndexDef & { _parts: Array<{ col?: string; expr?: string }> }
    >();
    for (const r of rows) {
      const name = r.INDEX_NAME;
      if (!byName.has(name))
        byName.set(name, { name, columns: [], unique: r.NON_UNIQUE === 0, _parts: [] });
      const entry = byName.get(name)!;
      if (r.COLUMN_NAME) entry._parts.push({ col: r.COLUMN_NAME });
      else if (r.EXPRESSION) entry._parts.push({ expr: r.EXPRESSION });
    }
    const result: TableIndexDef[] = [];
    for (const e of byName.values()) {
      const cols = e._parts.filter((p) => p.col).map((p) => p.col!);
      result.push({ name: e.name, columns: cols, unique: e.unique });
    }
    return result;
  }
}

/** MSSQL schema inspector using sys catalog views. */
export class MssqlSchemaInspector implements SchemaInspector {
  constructor(private provider: DatabaseProvider) {}

  public async listTables(): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ name: string }>(
      'SELECT name FROM sys.tables ORDER BY name'
    );
    return rows.map((r) => r.name);
  }

  public async getIndexes(table: string): Promise<TableIndexDef[]> {
    const idxRows = await this.provider.executeQuery<{
      name: string;
      is_unique: 0 | 1;
      filter_definition: string | null;
    }>(
      // Exclude clustered primary-key indexes — they are tracked via primaryKeys, not as explicit indexes.
      'SELECT i.name, i.is_unique, i.filter_definition FROM sys.indexes i WHERE i.object_id = OBJECT_ID(@p1) AND i.is_hypothetical = 0 AND i.name IS NOT NULL AND i.is_primary_key = 0',
      [table]
    );
    const colRows = await this.provider.executeQuery<{
      index_name: string;
      column_name: string;
      key_ordinal: number;
      is_descending_key: 0 | 1;
    }>(
      'SELECT i.name as index_name, c.name as column_name, ic.key_ordinal, ic.is_descending_key FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=i.object_id AND c.column_id=ic.column_id WHERE i.object_id = OBJECT_ID(@p1) ORDER BY i.name, ic.key_ordinal',
      [table]
    );
    const byName = new Map<string, TableIndexDef & { _cols: string[] }>();
    for (const r of idxRows) {
      byName.set(r.name, {
        name: r.name,
        columns: [],
        unique: r.is_unique === 1,
        where: r.filter_definition || undefined,
        _cols: []
      });
    }
    for (const r of colRows) {
      const e = byName.get(r.index_name);
      if (e) e._cols.push(r.column_name);
    }
    const result: TableIndexDef[] = [];
    for (const e of byName.values()) {
      result.push({ name: e.name, columns: e._cols, unique: e.unique, where: e.where });
    }
    return result;
  }
}

/**
 * Single selection point that maps a provider's dialect label to the matching
 * {@link SchemaInspector}. This is the only place dialect → inspector dispatch
 * is allowed to live; callers must not branch on the label themselves.
 *
 * Unknown-dialect policy: an unsupported label throws a typed
 * {@link UnsupportedOperationError} rather than silently falling back to a
 * divergent default (previously one path assumed tables existed while another
 * returned empty indexes). Schema inspection is only meaningful for a dialect
 * we know how to introspect.
 */
export class SchemaInspectorFactory {
  /**
   * Resolve the inspector for the given dialect label.
   *
   * @param label - The provider's `providerLabel` (e.g. `'postgresql'`).
   * @param provider - The database provider the inspector queries against.
   * @throws {UnsupportedOperationError} if the label is not a supported dialect.
   */
  public static for(label: string, provider: DatabaseProvider): SchemaInspector {
    switch (label) {
      case 'postgresql':
        return new PostgresSchemaInspector(provider);
      case 'mysql':
        return new MySqlSchemaInspector(provider);
      case 'mssql':
        return new MssqlSchemaInspector(provider);
      default:
        throw new UnsupportedOperationError(
          `Schema inspection is not supported for provider dialect '${label}'`,
          { details: { operation: 'SchemaInspectorFactory.for', providerLabel: label } }
        );
    }
  }
}
