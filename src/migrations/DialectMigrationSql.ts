import { SchemaDiff, TableDiff } from './DiffTypes';

export type Dialect = 'sqlite' | 'postgresql' | 'mysql' | 'mssql';

export function generateMigrationFromDiff(
  diff: SchemaDiff,
  dialect: Dialect
): { up: string[]; down: string[] } {
  const up: string[] = [];
  const down: string[] = [];
  for (const tableDiff of diff.tables) {
    if ((tableDiff as unknown as { renameTo?: string }).renameTo) {
      const to = (tableDiff as unknown as { renameTo?: string }).renameTo as string;
      switch (dialect) {
        case 'postgresql':
          up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} RENAME TO ${q(dialect, to)}`);
          break;
        case 'mysql':
          up.push(`RENAME TABLE ${q(dialect, tableDiff.table)} TO ${q(dialect, to)}`);
          break;
        case 'mssql':
          up.push(`EXEC sp_rename '${tableDiff.table}', '${to}'`);
          break;
        default:
          up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} RENAME TO ${q(dialect, to)}`);
      }
    }
    if (tableDiff.create) {
      up.push(buildCreateTableSql(tableDiff, dialect));
      // create indexes if defined
      if (tableDiff.create.indexes && tableDiff.create.indexes.length > 0) {
        for (const idx of tableDiff.create.indexes) {
          const uniq = idx.unique ? 'UNIQUE ' : '';
          const cols = idx.columns.map((column) => q(dialect, column)).join(', ');
          const name = q(dialect, idx.name);
          up.push(`CREATE ${uniq}INDEX ${name} ON ${q(dialect, tableDiff.create.name)} (${cols})`);
        }
      }
      down.push(`DROP TABLE ${q(dialect, tableDiff.create.name)}`);
      continue;
    }
    if (tableDiff.drop) {
      up.push(`DROP TABLE ${q(dialect, tableDiff.table)}`);
      // Down неизвестен без snapshot, пропустим
      continue;
    }
    if ((tableDiff as unknown as { indexCreates?: Array<{ name: string; columns: string[]; unique?: boolean }> }).indexCreates && (tableDiff as unknown as { indexCreates?: Array<{ name: string; columns: string[]; unique?: boolean }> }).indexCreates!.length > 0) {
      for (const idx of (tableDiff as unknown as { indexCreates?: Array<{ name: string; columns: string[]; unique?: boolean }> }).indexCreates!) {
        const uniq = idx.unique ? 'UNIQUE ' : '';
        const cols = idx.columns.map((column: string) => q(dialect, column)).join(', ');
        const name = q(dialect, idx.name);
        up.push(`CREATE ${uniq}INDEX ${name} ON ${q(dialect, tableDiff.table)} (${cols})`);
      }
    }
    if ((tableDiff as unknown as { indexDrops?: string[] }).indexDrops && (tableDiff as unknown as { indexDrops?: string[] }).indexDrops!.length > 0) {
      for (const nameRaw of (tableDiff as unknown as { indexDrops?: string[] }).indexDrops!) {
        const name = q(dialect, nameRaw);
        // Generic DROP INDEX form; some dialects require table qualifier or IF EXISTS, kept simple here
        up.push(`DROP INDEX ${name}`);
      }
    }
    if ((tableDiff as unknown as { fkCreates?: Array<{ name?: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }> }).fkCreates && (tableDiff as unknown as { fkCreates?: Array<{ name?: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }> }).fkCreates!.length > 0) {
      for (const fk of (tableDiff as unknown as { fkCreates?: Array<{ name?: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }> }).fkCreates!) {
        const name = fk.name ? `CONSTRAINT ${q(dialect, fk.name)} ` : '';
        const cols = fk.columns.map((column: string) => q(dialect, column)).join(', ');
        const refCols = fk.refColumns.map((column: string) => q(dialect, column)).join(', ');
        const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
        const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
        switch (dialect) {
          case 'postgresql':
          case 'mysql':
          case 'mssql':
            up.push(
              `ALTER TABLE ${q(dialect, tableDiff.table)} ADD ${name}FOREIGN KEY (${cols}) REFERENCES ${q(
                dialect,
                fk.refTable
              )} (${refCols})${onDel}${onUpd}`
            );
            break;
          default:
            up.push(
              `-- SQLite requires table rebuild to add FK: ${name}(${cols}) -> ${fk.refTable}(${refCols})`
            );
        }
      }
    }
    if ((tableDiff as unknown as { fkDrops?: string[] }).fkDrops && (tableDiff as unknown as { fkDrops?: string[] }).fkDrops!.length > 0) {
      for (const nameRaw of (tableDiff as unknown as { fkDrops?: string[] }).fkDrops!) {
        switch (dialect) {
          case 'postgresql':
            up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} DROP CONSTRAINT ${q(dialect, nameRaw)}`);
            break;
          case 'mysql':
            up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} DROP FOREIGN KEY ${q(dialect, nameRaw)}`);
            break;
          case 'mssql':
            up.push(`ALTER TABLE ${q(dialect, tableDiff.table)} DROP CONSTRAINT ${q(dialect, nameRaw)}`);
            break;
          default:
            up.push(`-- SQLite requires table rebuild to drop FK: ${nameRaw}`);
        }
      }
    }
    if (tableDiff.columnChanges && tableDiff.columnChanges.length > 0) {
      for (const ch of tableDiff.columnChanges) {
        if (ch.kind === 'add') {
          up.push(
            buildAddColumnSql(
              dialect,
              tableDiff,
              ch.column.name,
              ch.column.type,
              ch.column.nullable,
              ch.column.defaultValue
            )
          );
          down.push(buildDropColumnSql(dialect, tableDiff.table, ch.column.name));
        } else if (ch.kind === 'alter') {
          // Разделяем смену типа и nullability
          const alterType = ch.prev && norm(ch.prev.type) !== norm(ch.column.type);
          if (alterType)
            up.push(buildAlterTypeSql(dialect, tableDiff.table, ch.column.name, ch.column.type));
          const prevNullable = (ch.prev as { nullable?: boolean } | undefined)?.nullable;
          if (typeof prevNullable === 'boolean' && prevNullable !== ch.column.nullable) {
            up.push(buildAlterNullSql(dialect, tableDiff.table, ch.column.name, ch.column.nullable));
          }
        } else if (ch.kind === 'drop') {
          // Generate DROP COLUMN for dialects that support it
          up.push(buildDropColumnSql(dialect, tableDiff.table, ch.column.name));
        }
      }
    }
    if ((tableDiff as unknown as { columnRenames?: Array<{ from: string; to: string }> }).columnRenames && (tableDiff as unknown as { columnRenames?: Array<{ from: string; to: string }> }).columnRenames!.length > 0) {
      for (const rn of (tableDiff as unknown as { columnRenames?: Array<{ from: string; to: string }> }).columnRenames!) {
        switch (dialect) {
          case 'postgresql':
            up.push(
              `ALTER TABLE ${q(dialect, tableDiff.table)} RENAME COLUMN ${q(dialect, rn.from)} TO ${q(dialect, rn.to)}`
            );
            break;
          case 'mysql':
            // MySQL требует полный тип в MODIFY/CHANGE COLUMN — оставим как комментарий
            up.push(`-- MySQL requires full type for CHANGE COLUMN ${rn.from} -> ${rn.to}`);
            break;
          case 'mssql':
            up.push(`EXEC sp_rename '${tableDiff.table}.${rn.from}', '${rn.to}', 'COLUMN'`);
            break;
          default:
            up.push(`-- SQLite column rename requires pragma or rebuild: ${rn.from} -> ${rn.to}`);
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
  def?: unknown
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

function formatValue(dialect: Dialect, v: unknown): string {
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
