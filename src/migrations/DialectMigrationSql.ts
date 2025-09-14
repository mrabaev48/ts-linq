import type { SchemaDiff, TableDiff, ColumnChange, ColumnDef, IndexDef, ForeignKeyDef } from './DiffTypes';
import type { DialectSqlEmitter } from './emitters';
import { createEmitter } from './emitters';

export type Dialect = 'sqlite' | 'postgresql' | 'mysql' | 'mssql';

export function generateMigrationFromDiff(
  diff: SchemaDiff,
  dialect: Dialect
): { up: string[]; down: string[] } {
  const builder = new MigrationSqlBuilder(dialect);
  return builder.build(diff);
}

class MigrationSqlBuilder {
  private readonly dialect: Dialect;
  private readonly up: string[] = [];
  private readonly down: string[] = [];
  private readonly emitter: DialectSqlEmitter;

  constructor(dialect: Dialect) {
    this.dialect = dialect;
    this.emitter = createEmitter(dialect);
  }

  public build(diff: SchemaDiff): { up: string[]; down: string[] } {
    for (const tableDiff of diff.tables) {
      this.processTable(tableDiff);
    }
    return { up: this.up, down: this.down };
  }

  private processTable(tableDiff: TableDiff): void {
    this.handleTableRename(tableDiff);
    if (tableDiff.create) {
      this.handleTableCreate(tableDiff);
      return;
    }
    if (tableDiff.drop) {
      this.up.push(this.emitter.dropTable(tableDiff.table));
      return;
    }
    this.handleIndexCreates(tableDiff);
    this.handleIndexDrops(tableDiff);
    this.handleFkCreates(tableDiff);
    this.handleFkDrops(tableDiff);
    this.handleUniqueAndChecks(tableDiff);
    this.handleColumnChanges(tableDiff);
    this.handleColumnRenames(tableDiff);
  }

  private handleTableRename(tableDiff: TableDiff): void {
    const to = tableDiff.renameTo;
    if (!to) return;
    this.up.push(this.emitter.renameTable(tableDiff.table, to));
  }

  private handleTableCreate(tableDiff: TableDiff): void {
    this.up.push(this.emitter.createTable(tableDiff));
    if (tableDiff.create && tableDiff.create.indexes && tableDiff.create.indexes.length > 0) {
      for (const indexDef of tableDiff.create.indexes) {
        const uniqueSql = indexDef.unique ? 'UNIQUE ' : '';
        const columnsSql = indexDef.columns.map((columnName) => this.emitter.q(columnName)).join(', ');
        const indexName = this.emitter.q(indexDef.name);
        this.up.push(`CREATE ${uniqueSql}INDEX ${indexName} ON ${this.emitter.q(tableDiff.create.name)} (${columnsSql})`);
      }
    }
    if (tableDiff.create)
      this.down.push(`DROP TABLE ${this.emitter.q(tableDiff.create.name)}`);
  }

  private handleIndexCreates(tableDiff: TableDiff): void {
    const creates: IndexDef[] = tableDiff.indexCreates || [];
    for (const indexDef of creates) this.up.push(this.emitter.createIndex(tableDiff.table, indexDef));
  }

  private handleIndexDrops(tableDiff: TableDiff): void {
    const drops: string[] = tableDiff.indexDrops || [];
    for (const indexNameRaw of drops) {
      this.up.push(this.emitter.dropIndex(tableDiff.table, indexNameRaw));
    }
  }

  private handleFkCreates(tableDiff: TableDiff): void {
    const creates: ForeignKeyDef[] = tableDiff.fkCreates || [];
    for (const foreignKey of creates) this.up.push(this.emitter.addForeignKey(tableDiff.table, foreignKey));
  }

  private handleFkDrops(tableDiff: TableDiff): void {
    const drops: string[] = tableDiff.fkDrops || [];
    for (const constraintNameRaw of drops) this.up.push(this.emitter.dropForeignKey(tableDiff.table, constraintNameRaw));
  }

  private handleUniqueAndChecks(tableDiff: TableDiff): void {
    for (const uq of tableDiff.uniqueCreates || []) this.up.push(this.emitter.createUniqueConstraint(tableDiff.table, uq));
    for (const uqName of tableDiff.uniqueDrops || []) this.up.push(this.emitter.dropUniqueConstraint(tableDiff.table, uqName));
    for (const ckName of tableDiff.checkDrops || []) this.up.push(this.emitter.dropCheckConstraint(tableDiff.table, ckName));
    for (const ck of tableDiff.checkCreates || []) this.up.push(this.emitter.addCheckConstraint(tableDiff.table, ck));
  }

  private handleColumnChanges(tableDiff: TableDiff): void {
    const changes: ColumnChange[] = tableDiff.columnChanges || [];
    for (const columnChange of changes) {
      if (columnChange.kind === 'add') this.handleColumnAdd(tableDiff, columnChange);
      else if (columnChange.kind === 'alter') this.handleColumnAlter(tableDiff, columnChange);
      else if (columnChange.kind === 'drop') this.handleColumnDrop(tableDiff, columnChange);
    }
  }

  private handleColumnAdd(tableDiff: TableDiff, change: ColumnChange): void {
    this.up.push(this.emitter.addColumn(tableDiff.table, change.column.name, change.column.type, change.column.nullable, change.column.defaultValue));
    this.down.push(this.emitter.dropColumn(tableDiff.table, change.column.name));
  }

  private handleColumnAlter(tableDiff: TableDiff, change: ColumnChange): void {
    const previous = change.prev;
    const prevForType = (previous
      ? { type: previous.type, length: previous.length, precision: previous.precision, scale: previous.scale }
      : { type: change.column.type }) as { type: string; length?: number; precision?: number; scale?: number };
    const prevTypeSql = this.emitter.mapTypeWithModifiers(prevForType);
    const nextTypeSql = this.emitter.mapTypeWithModifiers({ type: change.column.type, length: change.column.length, precision: change.column.precision, scale: change.column.scale });
    const alterTypeNeeded = prevTypeSql !== nextTypeSql;
    if (alterTypeNeeded) {
      this.up.push(this.emitter.alterType(tableDiff.table, change.column.name, nextTypeSql));
    }
    const prevNullable = previous?.nullable;
    if (typeof prevNullable === 'boolean' && prevNullable !== change.column.nullable) {
      this.up.push(this.emitter.alterNull(tableDiff.table, change.column.name, change.column.nullable));
    }
    const prevDef = previous?.defaultValue;
    const nextDef = change.column.defaultValue;
    if (prevDef !== nextDef) {
      const stmts = this.emitter.alterDefault(tableDiff.table, change.column.name, nextDef);
      this.up.push(...stmts);
    }
  }

  private handleColumnDrop(tableDiff: TableDiff, change: ColumnChange): void {
    this.up.push(this.emitter.dropColumn(tableDiff.table, change.column.name));
  }

  private handleColumnRenames(tableDiff: TableDiff): void {
    const renames: Array<{ from: string; to: string; toDef?: ColumnDef }> = tableDiff.columnRenames || [];
    for (const rename of renames) {
      switch (this.dialect) {
        case 'postgresql':
          this.up.push(`ALTER TABLE ${this.emitter.q(tableDiff.table)} RENAME COLUMN ${this.emitter.q(rename.from)} TO ${this.emitter.q(rename.to)}`);
          break;
        case 'mysql': {
          const nextType = rename.toDef ? this.emitter.mapTypeWithModifiers({ type: rename.toDef.type, length: rename.toDef.length, precision: rename.toDef.precision, scale: rename.toDef.scale }) : 'TEXT';
          this.up.push(`ALTER TABLE ${this.emitter.q(tableDiff.table)} CHANGE COLUMN ${this.emitter.q(rename.from)} ${this.emitter.q(rename.to)} ${nextType}`);
          break;
        }
        case 'mssql':
          this.up.push(`EXEC sp_rename '${tableDiff.table}.${rename.from}', '${rename.to}', 'COLUMN'`);
          break;
        default:
          this.up.push(`-- SQLite column rename requires pragma or rebuild: ${rename.from} -> ${rename.to}`);
      }
    }
  }
}
