import type { DatabaseProvider } from '@ts-linq/core';
import type {
  DatabaseColumnModel,
  DatabaseForeignKeyModel,
  DatabaseIndexModel,
  DatabaseModel,
  DatabaseTableModel,
  DbIntrospector
} from '@ts-linq/types';

function normalizeMssqlType(raw: string): string {
  const t = raw.toLowerCase();
  if (/int|bigint|smallint|tinyint/.test(t)) return 'INTEGER';
  if (/decimal|numeric|money|smallmoney/.test(t)) return 'DECIMAL';
  if (/float|real/.test(t)) return 'REAL';
  if (/datetime|smalldatetime|date|time/.test(t)) return 'DATETIME';
  if (/^bit$/.test(t)) return 'BOOLEAN';
  if (/binary|varbinary|image/.test(t)) return 'BLOB';
  if (/uniqueidentifier/.test(t)) return 'UUID';
  return 'TEXT';
}

export class MssqlDbIntrospector implements DbIntrospector {
  public constructor(private readonly provider: DatabaseProvider) {}

  public async introspect(schema?: string): Promise<DatabaseModel> {
    const sch = schema ?? 'dbo';
    const tableNames = await this.listTables(sch);
    const tables: DatabaseTableModel[] = [];
    for (const name of tableNames) {
      const table = await this.introspectTable(name, sch);
      tables.push(table);
    }
    return { tables };
  }

  private async listTables(schema: string): Promise<string[]> {
    const rows = await this.provider.executeQuery<{ TABLE_NAME: string }>(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @p1 AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
      [schema]
    );
    return rows.map((r) => r.TABLE_NAME);
  }

  private async introspectTable(table: string, schema: string): Promise<DatabaseTableModel> {
    const columns = await this.getColumns(table, schema);
    const primaryKeys = columns.filter((c) => c.isPrimary).map((c) => c.name);
    const foreignKeys = await this.getForeignKeys(table, schema);
    const indexes = await this.getIndexes(table, schema);
    return { name: table, schema, columns, primaryKeys, foreignKeys, indexes };
  }

  private async getColumns(table: string, schema: string): Promise<DatabaseColumnModel[]> {
    const colRows = await this.provider.executeQuery<{
      COLUMN_NAME: string;
      DATA_TYPE: string;
      IS_NULLABLE: 'YES' | 'NO';
      COLUMN_DEFAULT: string | null;
    }>(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = @p1 AND TABLE_NAME = @p2
       ORDER BY ORDINAL_POSITION`,
      [schema, table]
    );

    const pkRows = await this.provider.executeQuery<{ COLUMN_NAME: string }>(
      `SELECT k.COLUMN_NAME
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t
       JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
         ON t.CONSTRAINT_NAME = k.CONSTRAINT_NAME
        AND t.TABLE_SCHEMA = k.TABLE_SCHEMA
       WHERE t.TABLE_SCHEMA = @p1 AND t.TABLE_NAME = @p2 AND t.CONSTRAINT_TYPE = 'PRIMARY KEY'
       ORDER BY k.ORDINAL_POSITION`,
      [schema, table]
    );
    const pkSet = new Set(pkRows.map((r) => r.COLUMN_NAME));

    const identityRows = await this.provider.executeQuery<{ name: string }>(
      `SELECT c.name
       FROM sys.identity_columns ic
       JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
       JOIN sys.tables t ON t.object_id = ic.object_id
       JOIN sys.schemas s ON s.schema_id = t.schema_id
       WHERE s.name = @p1 AND t.name = @p2`,
      [schema, table]
    );
    const identitySet = new Set(identityRows.map((r) => r.name));

    return colRows.map((r) => {
      const rawType = (r.DATA_TYPE || '').toLowerCase();
      const isIdentity = identitySet.has(r.COLUMN_NAME);
      return {
        name: r.COLUMN_NAME,
        dbType: rawType,
        ormType: normalizeMssqlType(rawType),
        nullable: r.IS_NULLABLE === 'YES',
        isPrimary: pkSet.has(r.COLUMN_NAME),
        isIdentity,
        defaultExpression: r.COLUMN_DEFAULT != null && !isIdentity ? r.COLUMN_DEFAULT : undefined
      };
    });
  }

  private async getForeignKeys(table: string, schema: string): Promise<DatabaseForeignKeyModel[]> {
    const rows = await this.provider.executeQuery<{
      fk_name: string;
      col_name: string;
      ref_table: string;
      ref_col: string;
      delete_action: string;
    }>(
      `SELECT
         fk.name AS fk_name,
         c.name AS col_name,
         rt.name AS ref_table,
         rc.name AS ref_col,
         fk.delete_referential_action_desc AS delete_action
       FROM sys.foreign_keys fk
       JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
       JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
       JOIN sys.tables pt ON pt.object_id = fkc.parent_object_id
       JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
       JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
       JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
       WHERE ps.name = @p1 AND pt.name = @p2
       ORDER BY fk.name, fkc.constraint_column_id`,
      [schema, table]
    );

    const byName = new Map<string, DatabaseForeignKeyModel>();
    for (const r of rows) {
      const existing = byName.get(r.fk_name);
      if (existing) {
        existing.columns.push(r.col_name);
        existing.referencedColumns.push(r.ref_col);
      } else {
        byName.set(r.fk_name, {
          name: r.fk_name,
          columns: [r.col_name],
          referencedTable: r.ref_table,
          referencedColumns: [r.ref_col],
          onDelete: r.delete_action !== 'NO_ACTION' ? r.delete_action : undefined
        });
      }
    }
    return [...byName.values()];
  }

  private async getIndexes(table: string, schema: string): Promise<DatabaseIndexModel[]> {
    const rows = await this.provider.executeQuery<{
      index_name: string;
      is_unique: boolean;
      col_name: string;
      is_desc: boolean;
      filter_def: string | null;
      key_ordinal: number;
    }>(
      `SELECT
         i.name AS index_name,
         i.is_unique,
         c.name AS col_name,
         ic.is_descending_key AS is_desc,
         i.filter_definition AS filter_def,
         ic.key_ordinal
       FROM sys.indexes i
       JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
       JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
       JOIN sys.tables t ON t.object_id = i.object_id
       JOIN sys.schemas s ON s.schema_id = t.schema_id
       WHERE s.name = @p1 AND t.name = @p2
         AND i.is_primary_key = 0
         AND i.is_hypothetical = 0
         AND i.type > 0
       ORDER BY i.name, ic.key_ordinal`,
      [schema, table]
    );

    const byName = new Map<
      string,
      DatabaseIndexModel & { _parts: Array<{ col: string; ord: number }> }
    >();
    for (const r of rows) {
      let entry = byName.get(r.index_name);
      if (!entry) {
        entry = {
          name: r.index_name,
          columns: [],
          unique: r.is_unique,
          where: r.filter_def ?? undefined,
          _parts: []
        };
        byName.set(r.index_name, entry);
      }
      entry._parts.push({ col: r.col_name, ord: r.key_ordinal });
    }

    return [...byName.values()].map(({ _parts, ...rest }) => ({
      ...rest,
      columns: _parts.sort((a, b) => a.ord - b.ord).map((p) => p.col)
    }));
  }
}
