import { SchemaDiff, TableDiff } from './DiffTypes';

export type Dialect = 'sqlite' | 'postgresql' | 'mysql' | 'mssql';

export function generateMigrationFromDiff(
  diff: SchemaDiff,
  dialect: Dialect
): { up: string[]; down: string[] } {
  const up: string[] = [];
  const down: string[] = [];
  for (const td of diff.tables) {
    if (td.create) {
      up.push(buildCreateTableSql(td, dialect));
      // create indexes if defined
      if (td.create.indexes && td.create.indexes.length > 0) {
        for (const idx of td.create.indexes) {
          const uniq = idx.unique ? 'UNIQUE ' : '';
          const cols = idx.columns.map((c) => q(dialect, c)).join(', ');
          const name = q(dialect, idx.name);
          up.push(`CREATE ${uniq}INDEX ${name} ON ${q(dialect, td.create.name)} (${cols})`);
        }
      }
      down.push(`DROP TABLE ${q(dialect, td.create.name)}`);
      continue;
    }
    if (td.drop) {
      up.push(`DROP TABLE ${q(dialect, td.table)}`);
      // Down неизвестен без snapshot, пропустим
      continue;
    }
    if (td.columnChanges && td.columnChanges.length > 0) {
      for (const ch of td.columnChanges) {
        if (ch.kind === 'add') {
          up.push(
            buildAddColumnSql(
              dialect,
              td,
              ch.column.name,
              ch.column.type,
              ch.column.nullable,
              ch.column.defaultValue
            )
          );
          down.push(buildDropColumnSql(dialect, td.table, ch.column.name));
        } else if (ch.kind === 'alter') {
          // Разделяем смену типа и nullability
          const alterType = ch.prev && norm(ch.prev.type) !== norm(ch.column.type);
          if (alterType)
            up.push(buildAlterTypeSql(dialect, td.table, ch.column.name, ch.column.type));
          const prevNullable = (ch.prev as any)?.nullable;
          if (typeof prevNullable === 'boolean' && prevNullable !== ch.column.nullable) {
            up.push(buildAlterNullSql(dialect, td.table, ch.column.name, ch.column.nullable));
          }
        }
      }
    }
  }
  return { up, down };
}

function buildCreateTableSql(td: TableDiff, dialect: Dialect): string {
  const create = td.create!;
  const cols = create.columns.map(
    (c) =>
      `${q(dialect, c.name)} ${mapType(dialect, c.type)}${c.nullable ? '' : ' NOT NULL'}${c.defaultValue !== undefined ? ' DEFAULT ' + formatValue(dialect, c.defaultValue) : ''}`
  );
  if (create.primaryKeys && create.primaryKeys.length > 0)
    cols.push(`PRIMARY KEY (${create.primaryKeys.map((pk) => q(dialect, pk)).join(', ')})`);
  if (create.foreignKeys && create.foreignKeys.length > 0) {
    for (const fk of create.foreignKeys) {
      const name = fk.name ? `CONSTRAINT ${q(dialect, fk.name)} ` : '';
      const colsList = fk.columns.map((c) => q(dialect, c)).join(', ');
      const refCols = fk.refColumns.map((c) => q(dialect, c)).join(', ');
      const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
      const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
      cols.push(
        `${name}FOREIGN KEY (${colsList}) REFERENCES ${q(dialect, fk.refTable)} (${refCols})${onDel}${onUpd}`
      );
    }
  }
  return `CREATE TABLE IF NOT EXISTS ${q(dialect, create.name)} (${cols.join(', ')})`;
}

function buildAddColumnSql(
  dialect: Dialect,
  td: TableDiff,
  name: string,
  type: string,
  nullable: boolean,
  def?: any
): string {
  const table = q(dialect, td.table);
  const col = q(dialect, name);
  const typeSql = mapType(dialect, type);
  const nn = nullable ? '' : ' NOT NULL';
  const d = def !== undefined ? ` DEFAULT ${formatValue(dialect, def)}` : '';
  const kw = dialect === 'mssql' ? 'ADD' : 'ADD COLUMN';
  return `ALTER TABLE ${table} ${kw} ${col} ${typeSql}${nn}${d}`;
}

function buildDropColumnSql(dialect: Dialect, table: string, name: string): string {
  if (dialect === 'sqlite') return `-- DROP COLUMN ${name} is not supported directly in SQLite`;
  return `ALTER TABLE ${q(dialect, table)} DROP COLUMN ${q(dialect, name)}`;
}

function buildAlterTypeSql(dialect: Dialect, table: string, name: string, newType: string): string {
  const tableName = q(dialect, table);
  const columnName = q(dialect, name);
  const mappedType = mapType(dialect, newType);
  switch (dialect) {
    case 'postgresql':
      return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${mappedType}`;
    case 'mysql':
      return `ALTER TABLE ${tableName} MODIFY COLUMN ${columnName} ${mappedType}`;
    case 'mssql':
      return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${mappedType}`;
    default:
      return `-- ALTER TYPE not supported for sqlite; requires rebuild`;
  }
}

function buildAlterNullSql(
  dialect: Dialect,
  table: string,
  name: string,
  nullable: boolean
): string {
  const tableName = q(dialect, table);
  const columnName = q(dialect, name);
  switch (dialect) {
    case 'postgresql':
      return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${nullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`;
    case 'mysql':
      // Для MySQL требуется полный тип, здесь используется общий тип TEXT как упрощение
      return `-- MySQL requires full type in MODIFY for nullability; include in type alter`;
    case 'mssql':
      return `-- MSSQL requires full type in ALTER COLUMN for nullability; include in type alter`;
    default:
      return `-- SQLite nullability alter requires rebuild`;
  }
}

function q(dialect: Dialect, id: string): string {
  switch (dialect) {
    case 'postgresql':
      return '"' + id + '"';
    case 'mysql':
      return '`' + id + '`';
    case 'mssql':
      return '[' + id + ']';
    default:
      return id;
  }
}

function mapType(dialect: Dialect, t: string): string {
  const up = String(t || '').toUpperCase();
  switch (dialect) {
    case 'postgresql':
      if (up === 'INTEGER' || up === 'NUMBER') return 'INTEGER';
      if (up === 'TEXT' || up === 'STRING') return 'TEXT';
      if (up === 'BOOLEAN') return 'BOOLEAN';
      if (up === 'DATETIME' || up === 'DATE') return 'TIMESTAMPTZ';
      if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE') return 'DOUBLE PRECISION';
      return up;
    case 'mysql':
      if (up === 'INTEGER' || up === 'NUMBER') return 'INT';
      if (up === 'TEXT' || up === 'STRING') return 'TEXT';
      if (up === 'BOOLEAN') return 'TINYINT(1)';
      if (up === 'DATETIME' || up === 'DATE') return 'DATETIME';
      if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE') return 'DOUBLE';
      return up;
    case 'mssql':
      if (up === 'INTEGER' || up === 'NUMBER') return 'INT';
      if (up === 'TEXT' || up === 'STRING') return 'NVARCHAR(MAX)';
      if (up === 'BOOLEAN') return 'BIT';
      if (up === 'DATETIME' || up === 'DATE') return 'DATETIME2';
      if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE') return 'FLOAT';
      return up;
    default:
      if (up === 'INTEGER' || up === 'NUMBER') return 'INTEGER';
      if (up === 'TEXT' || up === 'STRING') return 'TEXT';
      if (up === 'BOOLEAN') return 'INTEGER';
      if (up === 'DATETIME' || up === 'DATE') return 'TEXT';
      if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE') return 'REAL';
      return up;
  }
}

function formatValue(dialect: Dialect, v: any): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') {
    switch (dialect) {
      case 'postgresql':
        return v ? 'TRUE' : 'FALSE';
      case 'mysql':
      case 'sqlite':
      default:
        return v ? '1' : '0';
      case 'mssql':
        return v ? '1' : '0';
    }
  }
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function norm(t: string): string {
  return String(t || '')
    .trim()
    .toUpperCase();
}
