import type { DatabaseProvider } from '../providers/DatabaseProvider';

export interface TableColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: unknown;
  pk: number;
}

export interface TableInfo {
  name: string;
  columns: TableColumnInfo[];
}

/** Simple SQLite schema inspector using sqlite_master and PRAGMA table_info. */
export class SQLiteSchemaInspector {
  constructor(private provider: DatabaseProvider) {}

  public async listTables(): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    return rows.map((r) => r.name);
  }

  public async getTableInfo(table: string): Promise<TableInfo> {
    const cols = await this.provider.executeQuery<TableColumnInfo>(`PRAGMA table_info(${table})`);
    return { name: table, columns: cols };
  }

  public async listUniqueIndexes(table: string): Promise<Array<{ name: string; columns: string[] }>> {
    const indexes = await this.provider.executeQuery<{ name: string; unique: number }>(
      `PRAGMA index_list(${table})`
    );
    const uniques = indexes.filter((i) => i.unique === 1);
    const result: Array<{ name: string; columns: string[] }> = [];
    for (const idx of uniques) {
      const info = await this.provider.executeQuery<{ name: string }>(`PRAGMA index_info(${idx.name})`);
      result.push({ name: idx.name, columns: info.map((c) => c.name) });
    }
    return result;
  }

  public async listIndexes(table: string): Promise<Array<{ name: string; columns: string[]; unique: boolean }>> {
    const indexes = await this.provider.executeQuery<{ name: string; unique: number }>(
      `PRAGMA index_list(${table})`
    );
    const result: Array<{ name: string; columns: string[]; unique: boolean }>= [];
    for (const idx of indexes) {
      // Skip implicit primary key index names like sqlite_autoindex_*
      if (/^sqlite_autoindex_/i.test(idx.name)) continue;
      const info = await this.provider.executeQuery<{ name: string }>(`PRAGMA index_info(${idx.name})`);
      result.push({ name: idx.name, columns: info.map((c) => c.name), unique: idx.unique === 1 });
    }
    return result;
  }

  public async listForeignKeys(table: string): Promise<Array<{ name?: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }>> {
    const rows = await this.provider.executeQuery<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
      on_update: string;
      on_delete: string;
    }>(`PRAGMA foreign_key_list(${table})`);
    const map = new Map<number, { columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }>();
    for (const r of rows) {
      const g = map.get(r.id) || { columns: [], refTable: r.table, refColumns: [], onDelete: r.on_delete || undefined, onUpdate: r.on_update || undefined };
      g.columns.push(r.from);
      g.refColumns.push(r.to);
      map.set(r.id, g);
    }
    return Array.from(map.values());
  }
}

/** Basic Postgres schema inspector using information_schema. */
export class PostgresSchemaInspector {
  constructor(private provider: DatabaseProvider) {}

  public async listTables(): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
    );
    return rows.map((r) => r.table_name);
  }

  public async getTableInfo(table: string): Promise<TableInfo> {
    const cols = await this.provider.executeQuery<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: unknown;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position`
    );
    const pkRows = await this.provider.executeQuery<{ column_name: string }>(
      `SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema WHERE tc.table_schema='public' AND tc.table_name='${table}' AND tc.constraint_type='PRIMARY KEY' ORDER BY kcu.ordinal_position`
    );
    const pkSet = new Set(pkRows.map((r) => r.column_name));
    return {
      name: table,
      columns: cols.map((c, idx) => ({
        name: c.column_name,
        type: c.data_type,
        notnull: c.is_nullable === 'NO',
        dflt_value: c.column_default,
        pk: pkSet.has(c.column_name) ? idx + 1 : 0
      }))
    };
  }

  public async listUniqueConstraints(table: string): Promise<Array<{ name?: string; columns: string[] }>> {
    const rows = await this.provider.executeQuery<{ constraint_name: string; column_name: string }>(
      `SELECT tc.constraint_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       WHERE tc.table_schema='public' AND tc.table_name='${table}' AND tc.constraint_type='UNIQUE'
       ORDER BY kcu.ordinal_position`
    );
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const arr = map.get(r.constraint_name) || [];
      arr.push(r.column_name);
      map.set(r.constraint_name, arr);
    }
    return Array.from(map.entries()).map(([name, columns]) => ({ name, columns }));
  }

  public async listCheckConstraints(table: string): Promise<Array<{ name?: string; expression: string }>> {
    const rows = await this.provider.executeQuery<{ constraint_name: string; check_clause: string }>(
      `SELECT conname as constraint_name, pg_get_constraintdef(c.oid) as check_clause
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE c.contype='c' AND n.nspname='public' AND t.relname='${table}'`
    );
    return rows.map((r) => ({ name: r.constraint_name, expression: r.check_clause.replace(/^CHECK\s*\((.*)\)$/i, '$1') }));
  }

  public async listIndexes(table: string): Promise<Array<{ name: string; columns: string[]; unique: boolean; expression?: string; where?: string }>> {
    const rows = await this.provider.executeQuery<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='${table}'`
    );
    const result: Array<{ name: string; columns: string[]; unique: boolean; expression?: string; where?: string }> = [];
    for (const r of rows) {
      const def = r.indexdef;
      const unique = /^CREATE\s+UNIQUE\s+INDEX/i.test(def);
      // Try to capture expression/columns inside ON <table> ... (...)
      const m = def.match(/ON\s+"?\w+"?\s+(?:USING\s+\w+\s+)?\(([^\)]*)\)/i);
      const whereMatch = def.match(/WHERE\s+(.*)$/i);
      const inside = m ? m[1].trim() : '';
      let columns: string[] = [];
      let expression: string | undefined = undefined;
      if (inside.includes(',')) {
        columns = inside
          .split(',')
          .map((s) => s.trim().replace(/"/g, ''));
      } else if (inside) {
        // single element might be expression or column
        const plainCol = inside.replace(/"/g, '');
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(plainCol)) {
          columns = [plainCol];
        } else {
          expression = `(${inside})`;
        }
      }
      const where = whereMatch ? whereMatch[1].trim() : undefined;
      result.push({ name: r.indexname, columns, unique, expression, where });
    }
    return result;
  }

  public async listForeignKeys(table: string): Promise<Array<{ name?: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }>> {
    const rows = await this.provider.executeQuery<{
      constraint_name: string;
      column_name: string;
      referenced_table: string;
      referenced_column: string;
      confdeltype: string;
      confupdtype: string;
      pos: number;
    }>(
      `SELECT con.conname as constraint_name,
              att2.attname as column_name,
              cl.relname as referenced_table,
              att.attname as referenced_column,
              con.confdeltype,
              con.confupdtype,
              k.n as pos
       FROM pg_constraint con
       JOIN LATERAL generate_subscripts(con.conkey,1) AS k(n) ON true
       JOIN pg_class cl ON cl.oid = con.confrelid
       JOIN pg_class cl2 ON cl2.oid = con.conrelid
       JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = con.confkey[k.n]
       JOIN pg_attribute att2 ON att2.attrelid = con.conrelid AND att2.attnum = con.conkey[k.n]
       JOIN pg_namespace ns ON ns.oid = con.connamespace
       WHERE con.contype='f' AND ns.nspname='public' AND cl2.relname='${table}'
       ORDER BY con.conname, k.n`
    );
    const map = new Map<string, { columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }>();
    function mapAction(code: string | undefined): string | undefined {
      switch ((code || '').toLowerCase()) {
        case 'c':
          return 'CASCADE';
        case 'n':
          return 'SET NULL';
        case 'd':
          return 'SET DEFAULT';
        case 'r':
          return 'RESTRICT';
        case 'a':
          return 'NO ACTION';
        default:
          return undefined;
      }
    }
    for (const r of rows) {
      const key = r.constraint_name;
      const g = map.get(key) || { columns: [], refTable: r.referenced_table, refColumns: [], onDelete: mapAction(r.confdeltype), onUpdate: mapAction(r.confupdtype) };
      g.columns.push(r.column_name);
      g.refColumns.push(r.referenced_column);
      map.set(key, g);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }
}

/** Basic MySQL schema inspector using information_schema. */
export class MysqlSchemaInspector {
  constructor(private provider: DatabaseProvider) {}

  public async listTables(): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ table_name: string }>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = "BASE TABLE" ORDER BY table_name'
    );
    return rows.map((r) => r.table_name);
  }

  public async getTableInfo(table: string): Promise<TableInfo> {
    const cols = await this.provider.executeQuery<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: unknown;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name='${table}' ORDER BY ordinal_position`
    );
    const pkRows = await this.provider.executeQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.key_column_usage WHERE table_schema = DATABASE() AND table_name='${table}' AND constraint_name='PRIMARY' ORDER BY ordinal_position`
    );
    const pkSet = new Set(pkRows.map((r) => r.column_name));
    return {
      name: table,
      columns: cols.map((c, idx) => ({
        name: c.column_name,
        type: c.data_type,
        notnull: c.is_nullable === 'NO',
        dflt_value: c.column_default,
        pk: pkSet.has(c.column_name) ? idx + 1 : 0
      }))
    };
  }

  public async listUniqueConstraints(table: string): Promise<Array<{ name?: string; columns: string[] }>> {
    const rows = await this.provider.executeQuery<{ constraint_name: string; column_name: string; ordinal_position: number }>(
      `SELECT constraint_name, column_name, ordinal_position
       FROM information_schema.key_column_usage
       WHERE table_schema = DATABASE() AND table_name='${table}' AND constraint_name <> 'PRIMARY'
       ORDER BY ordinal_position`
    );
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const arr = map.get(r.constraint_name) || [];
      arr.push(r.column_name);
      map.set(r.constraint_name, arr);
    }
    return Array.from(map.entries()).map(([name, columns]) => ({ name, columns }));
  }

  public async listCheckConstraints(_table: string): Promise<Array<{ name?: string; expression: string }>> {
    // MySQL historically lacks named CHECK constraints support pre-8.0; skip (best-effort)
    return [];
  }

  public async listIndexes(table: string): Promise<Array<{ name: string; columns: string[]; unique: boolean }>> {
    const rows = await this.provider.executeQuery<{ index_name: string; column_name: string; non_unique: number; seq_in_index: number }>(
      `SELECT index_name, column_name, non_unique, seq_in_index
       FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name='${table}'
       ORDER BY index_name, seq_in_index`
    );
    const map = new Map<string, { name: string; unique: boolean; columns: string[] }>();
    for (const r of rows) {
      const key = r.index_name;
      if (key === 'PRIMARY') continue;
      if (!map.has(key)) map.set(key, { name: key, unique: r.non_unique === 0, columns: [] });
      map.get(key)!.columns.push(r.column_name);
    }
    return Array.from(map.values());
  }

  public async listForeignKeys(table: string): Promise<Array<{ name?: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }>> {
    const rows = await this.provider.executeQuery<{
      constraint_name: string;
      column_name: string;
      referenced_table_name: string;
      referenced_column_name: string;
      ordinal_position: number;
      update_rule: string;
      delete_rule: string;
    }>(
      `SELECT k.constraint_name, k.column_name, k.referenced_table_name, k.referenced_column_name, k.ordinal_position, r.update_rule, r.delete_rule
       FROM information_schema.key_column_usage k
       JOIN information_schema.referential_constraints r ON r.constraint_name = k.constraint_name AND r.constraint_schema = k.constraint_schema
       WHERE k.table_schema = DATABASE() AND k.table_name='${table}' AND k.referenced_table_name IS NOT NULL
       ORDER BY k.constraint_name, k.ordinal_position`
    );
    const map = new Map<string, { columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }>();
    for (const r of rows) {
      const key = r.constraint_name;
      const g = map.get(key) || { columns: [], refTable: r.referenced_table_name, refColumns: [], onDelete: r.delete_rule?.toUpperCase(), onUpdate: r.update_rule?.toUpperCase() };
      g.columns.push(r.column_name);
      g.refColumns.push(r.referenced_column_name);
      map.set(key, g);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }
}

/** Basic MSSQL schema inspector using INFORMATION_SCHEMA views. */
export class MssqlSchemaInspector {
  constructor(private provider: DatabaseProvider) {}

  public async listTables(): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ TABLE_NAME: string }>(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_SCHEMA='dbo' ORDER BY TABLE_NAME"
    );
    return rows.map((r) => r.TABLE_NAME);
  }

  public async getTableInfo(table: string): Promise<TableInfo> {
    const cols = await this.provider.executeQuery<{
      COLUMN_NAME: string;
      DATA_TYPE: string;
      IS_NULLABLE: string;
      COLUMN_DEFAULT: unknown;
    }>(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION`
    );
    const pkRows = await this.provider.executeQuery<{ COLUMN_NAME: string }>(
      `SELECT k.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON k.CONSTRAINT_NAME = t.CONSTRAINT_NAME AND k.TABLE_SCHEMA=t.TABLE_SCHEMA WHERE t.TABLE_SCHEMA='dbo' AND t.TABLE_NAME='${table}' AND t.CONSTRAINT_TYPE='PRIMARY KEY' ORDER BY k.ORDINAL_POSITION`
    );
    const pkSet = new Set(pkRows.map((r) => r.COLUMN_NAME));
    return {
      name: table,
      columns: cols.map((c, idx) => ({
        name: c.COLUMN_NAME,
        type: c.DATA_TYPE,
        notnull: c.IS_NULLABLE === 'NO',
        dflt_value: c.COLUMN_DEFAULT,
        pk: pkSet.has(c.COLUMN_NAME) ? idx + 1 : 0
      }))
    };
  }

  public async listUniqueConstraints(table: string): Promise<Array<{ name?: string; columns: string[] }>> {
    const rows = await this.provider.executeQuery<{ CONSTRAINT_NAME: string; COLUMN_NAME: string; ORDINAL_POSITION: number }>(
      `SELECT t.CONSTRAINT_NAME, k.COLUMN_NAME, k.ORDINAL_POSITION
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t
       JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON k.CONSTRAINT_NAME = t.CONSTRAINT_NAME AND k.TABLE_SCHEMA=t.TABLE_SCHEMA
       WHERE t.TABLE_SCHEMA='dbo' AND t.TABLE_NAME='${table}' AND t.CONSTRAINT_TYPE='UNIQUE'
       ORDER BY k.ORDINAL_POSITION`
    );
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const arr = map.get(r.CONSTRAINT_NAME) || [];
      arr.push(r.COLUMN_NAME);
      map.set(r.CONSTRAINT_NAME, arr);
    }
    return Array.from(map.entries()).map(([name, columns]) => ({ name, columns }));
  }

  public async listCheckConstraints(table: string): Promise<Array<{ name?: string; expression: string }>> {
    const rows = await this.provider.executeQuery<{ CONSTRAINT_NAME: string; CHECK_CLAUSE: string }>(
      `SELECT CONSTRAINT_NAME, CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA='dbo' AND CONSTRAINT_NAME IN (
         SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${table}' AND CONSTRAINT_TYPE='CHECK'
       )`
    );
    return rows.map((r) => ({ name: r.CONSTRAINT_NAME, expression: r.CHECK_CLAUSE }));
  }

  public async listIndexes(table: string): Promise<Array<{ name: string; columns: string[]; unique: boolean; where?: string }>> {
    const rows = await this.provider.executeQuery<{
      name: string;
      is_unique: number;
      filter_definition: string | null;
      column_name: string;
      index_id: number;
      key_ordinal: number;
    }>(
      `SELECT i.name, i.is_unique, i.filter_definition, c.name as column_name, ic.index_id, ic.key_ordinal
       FROM sys.indexes i
       JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
       JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
       JOIN sys.tables t ON t.object_id = i.object_id
       WHERE t.schema_id = SCHEMA_ID('dbo') AND t.name='${table}' AND i.is_hypothetical = 0
       ORDER BY ic.key_ordinal`
    );
    const map = new Map<number, { name: string; unique: boolean; where?: string; columns: string[] }>();
    for (const r of rows) {
      const key = r.index_id;
      if (!map.has(key)) map.set(key, { name: r.name, unique: r.is_unique === 1, where: r.filter_definition || undefined, columns: [] });
      map.get(key)!.columns.push(r.column_name);
    }
    return Array.from(map.values());
  }

  public async listForeignKeys(table: string): Promise<Array<{ name?: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }>> {
    const rows = await this.provider.executeQuery<{
      constraint_name: string;
      column_name: string;
      referenced_table: string;
      referenced_column: string;
      pos: number;
      delete_rule: string;
      update_rule: string;
    }>(
      `SELECT fk.name as constraint_name,
              c1.name as column_name,
              t2.name as referenced_table,
              c2.name as referenced_column,
              fkc.constraint_column_id as pos,
              fk.delete_referential_action_desc as delete_rule,
              fk.update_referential_action_desc as update_rule
       FROM sys.foreign_keys fk
       JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
       JOIN sys.tables t1 ON t1.object_id = fk.parent_object_id
       JOIN sys.columns c1 ON c1.object_id = t1.object_id AND c1.column_id = fkc.parent_column_id
       JOIN sys.tables t2 ON t2.object_id = fk.referenced_object_id
       JOIN sys.columns c2 ON c2.object_id = t2.object_id AND c2.column_id = fkc.referenced_column_id
       JOIN sys.schemas s1 ON s1.schema_id = t1.schema_id
       WHERE s1.name='dbo' AND t1.name='${table}'
       ORDER BY fk.name, fkc.constraint_column_id`
    );
    const map = new Map<string, { columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }>();
    for (const r of rows) {
      const key = r.constraint_name;
      const g = map.get(key) || { columns: [], refTable: r.referenced_table, refColumns: [], onDelete: (r.delete_rule || '').toUpperCase(), onUpdate: (r.update_rule || '').toUpperCase() };
      g.columns.push(r.column_name);
      g.refColumns.push(r.referenced_column);
      map.set(key, g);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }
}
