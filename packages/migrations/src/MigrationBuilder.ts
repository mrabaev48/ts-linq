import type { Dialect } from './DialectMigrationSql';
import { generateMigrationFromDiff } from './DialectMigrationSql';
import type { MigrationSql, SchemaDiff, TableDiff } from './DiffTypes';

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  defaultExpression?: string;
}

interface IndexDef {
  name: string;
  columns: string[];
  unique?: boolean;
}

interface ForeignKeyDef {
  name?: string;
  columns: string[];
  refTable: string;
  refColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

class TableBuilder {
  public readonly name: string;
  public columns: ColumnDef[] = [];
  public primaryKeys: string[] = [];
  public indexes: IndexDef[] = [];
  public foreignKeys: ForeignKeyDef[] = [];

  constructor(name: string) {
    this.name = name;
  }

  column(
    name: string,
    type: string,
    opts?: { nullable?: boolean; defaultValue?: unknown; defaultExpression?: string }
  ): this {
    this.columns.push({
      name,
      type,
      nullable: opts?.nullable ?? true,
      defaultValue: opts?.defaultValue,
      defaultExpression: opts?.defaultExpression
    });
    return this;
  }

  primaryKey(...cols: string[]): this {
    this.primaryKeys = cols;
    return this;
  }

  index(name: string, columns: string[], unique: boolean = false): this {
    this.indexes.push({ name, columns, unique });
    return this;
  }

  foreignKey(def: ForeignKeyDef): this {
    this.foreignKeys.push(def);
    return this;
  }
}

export class MigrationBuilder {
  private creates: Map<string, TableBuilder> = new Map();
  private drops: Set<string> = new Set();
  private columnAdds: Array<{ table: string; col: ColumnDef }> = [];
  private columnAlters: Array<{ table: string; col: ColumnDef; prev?: ColumnDef }> = [];
  private columnDrops: Array<{ table: string; name: string }> = [];
  private indexCreates: Array<{ table: string; index: IndexDef }> = [];
  private indexDrops: Array<{ table: string; name: string }> = [];
  private fkCreates: Array<{ table: string; fk: ForeignKeyDef }> = [];
  private fkDrops: Array<{ table: string; name: string }> = [];
  private tableRenames: Array<{ from: string; to: string }> = [];
  private columnRenames: Array<{ table: string; from: string; to: string }> = [];

  createTable(name: string, build: (t: TableBuilder) => void): this {
    const tb = new TableBuilder(name);
    build(tb);
    this.creates.set(name, tb);
    return this;
  }

  dropTable(name: string): this {
    this.drops.add(name);
    return this;
  }

  alterTable(
    name: string,
    ops: (t: {
      addColumn: (
        name: string,
        type: string,
        opts?: { nullable?: boolean; defaultValue?: unknown }
      ) => void;
      alterColumn: (
        name: string,
        type?: string,
        opts?: { nullable?: boolean; defaultValue?: unknown }
      ) => void;
      dropColumn: (name: string) => void;
    }) => void
  ): this {
    const api = {
      addColumn: (
        colName: string,
        type: string,
        opts?: { nullable?: boolean; defaultValue?: unknown; defaultExpression?: string }
      ) => {
        this.columnAdds.push({
          table: name,
          col: {
            name: colName,
            type,
            nullable: opts?.nullable ?? true,
            defaultValue: opts?.defaultValue,
            defaultExpression: opts?.defaultExpression
          }
        });
      },
      alterColumn: (
        colName: string,
        type?: string,
        opts?: { nullable?: boolean; defaultValue?: unknown; defaultExpression?: string }
      ) => {
        const target = {
          name: colName,
          type: type ?? 'TEXT',
          nullable: opts?.nullable ?? true,
          defaultValue: opts?.defaultValue,
          defaultExpression: opts?.defaultExpression
        };
        // Provide a synthetic prev to force emission of ALTER statements when prior state is unknown
        const prev: ColumnDef = {
          name: colName,
          type: type ? '__DIFF_FORCE__' : target.type,
          // Flip nullable if provided to ensure difference is detected; otherwise leave undefined
          nullable: typeof opts?.nullable === 'boolean' ? !opts.nullable : target.nullable,
          defaultExpression: target.defaultExpression ? '__DIFF_FORCE__' : undefined
        };
        this.columnAlters.push({ table: name, col: target, prev });
      },
      dropColumn: (colName: string) => {
        this.columnDrops.push({ table: name, name: colName });
      }
    };
    ops(api);
    return this;
  }

  createIndex(table: string, name: string, columns: string[], unique: boolean = false): this {
    this.indexCreates.push({ table, index: { name, columns, unique } });
    return this;
  }

  dropIndex(table: string, name: string): this {
    this.indexDrops.push({ table, name });
    return this;
  }

  addForeignKey(
    table: string,
    fk: {
      name?: string;
      columns: string[];
      refTable: string;
      refColumns: string[];
      onDelete?: string;
      onUpdate?: string;
    }
  ): this {
    this.fkCreates.push({ table, fk });
    return this;
  }

  dropForeignKey(table: string, name: string): this {
    this.fkDrops.push({ table, name });
    return this;
  }

  renameTable(from: string, to: string): this {
    this.tableRenames.push({ from, to });
    return this;
  }

  renameColumn(table: string, from: string, to: string): this {
    this.columnRenames.push({ table, from, to });
    return this;
  }

  toDiff(): SchemaDiff {
    const tables: TableDiff[] = [];
    this.collectCreates(tables);
    this.collectDrops(tables);
    const ensure = this.ensureTableFactory(tables);
    this.collectColumnChanges(ensure);
    this.collectIndexChanges(ensure);
    this.collectForeignKeyChanges(ensure);
    this.collectRenames(ensure);
    return { tables };
  }

  private collectCreates(tables: TableDiff[]): void {
    for (const [name, tb] of this.creates) {
      tables.push({
        table: name,
        create: {
          name,
          columns: tb.columns.map((c) => ({
            name: c.name,
            columnName: c.name,
            type: c.type,
            nullable: c.nullable ?? true,
            defaultValue: c.defaultValue
          })),
          primaryKeys: tb.primaryKeys,
          indexes: tb.indexes.map((i) => ({
            name: i.name,
            columns: i.columns,
            unique: !!i.unique
          })),
          foreignKeys: tb.foreignKeys.map((f) => ({
            name: f.name,
            columns: f.columns,
            refTable: f.refTable,
            refColumns: f.refColumns,
            onDelete: f.onDelete,
            onUpdate: f.onUpdate
          }))
        }
      });
    }
  }

  private collectDrops(tables: TableDiff[]): void {
    for (const name of this.drops) tables.push({ table: name, drop: true });
  }

  private ensureTableFactory(tables: TableDiff[]): (t: string) => TableDiff {
    const byTable = new Map<string, TableDiff>();
    return (t: string): TableDiff => {
      let td = byTable.get(t);
      if (!td) {
        td = { table: t, columnChanges: [] };
        byTable.set(t, td);
        tables.push(td);
      }
      return td;
    };
  }

  private collectColumnChanges(ensure: (t: string) => TableDiff): void {
    for (const add of this.columnAdds) {
      ensure(add.table).columnChanges!.push({
        kind: 'add',
        column: {
          name: add.col.name,
          type: add.col.type,
          nullable: add.col.nullable ?? true,
          defaultValue: add.col.defaultValue
        }
      });
    }
    for (const alt of this.columnAlters) {
      ensure(alt.table).columnChanges!.push({
        kind: 'alter',
        column: {
          name: alt.col.name,
          type: alt.col.type,
          nullable: alt.col.nullable ?? true,
          defaultValue: alt.col.defaultValue
        },
        prev: alt.prev
      });
    }
    for (const drop of this.columnDrops) {
      ensure(drop.table).columnChanges!.push({
        kind: 'drop',
        column: { name: drop.name, type: 'TEXT', nullable: true }
      });
    }
  }

  private collectIndexChanges(ensure: (t: string) => TableDiff): void {
    for (const indexCreate of this.indexCreates) {
      const tableDiff = ensure(indexCreate.table);
      tableDiff.indexCreates = tableDiff.indexCreates ?? [];
      tableDiff.indexCreates.push({
        name: indexCreate.index.name,
        columns: indexCreate.index.columns,
        unique: !!indexCreate.index.unique
      });
    }
    for (const indexDrop of this.indexDrops) {
      const tableDiff = ensure(indexDrop.table);
      tableDiff.indexDrops = tableDiff.indexDrops ?? [];
      tableDiff.indexDrops.push(indexDrop.name);
    }
  }

  private collectForeignKeyChanges(ensure: (t: string) => TableDiff): void {
    for (const foreignKeyCreate of this.fkCreates) {
      const tableDiff = ensure(foreignKeyCreate.table);
      tableDiff.fkCreates = tableDiff.fkCreates ?? [];
      tableDiff.fkCreates.push(foreignKeyCreate.fk);
    }
    for (const foreignKeyDrop of this.fkDrops) {
      const tableDiff = ensure(foreignKeyDrop.table);
      tableDiff.fkDrops = tableDiff.fkDrops ?? [];
      tableDiff.fkDrops.push(foreignKeyDrop.name);
    }
  }

  private collectRenames(ensure: (t: string) => TableDiff): void {
    for (const tableRename of this.tableRenames) ensure(tableRename.from).renameTo = tableRename.to;
    for (const columnRename of this.columnRenames) {
      const tableDiff = ensure(columnRename.table);
      tableDiff.columnRenames = tableDiff.columnRenames ?? [];
      tableDiff.columnRenames.push({ from: columnRename.from, to: columnRename.to });
    }
  }

  toSql(dialect: Dialect): MigrationSql {
    return generateMigrationFromDiff(this.toDiff(), dialect);
  }
}
