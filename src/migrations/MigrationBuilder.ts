import { SchemaDiff, TableDiff } from './DiffTypes';
import { Dialect, generateMigrationFromDiff } from './DialectMigrationSql';

interface ColumnDef {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: any;
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

  column(name: string, type: string, opts?: { nullable?: boolean; defaultValue?: any }): this {
    this.columns.push({ name, type, nullable: opts?.nullable ?? true, defaultValue: opts?.defaultValue });
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

  alterTable(name: string, ops: (t: {
    addColumn: (name: string, type: string, opts?: { nullable?: boolean; defaultValue?: any }) => void;
    alterColumn: (name: string, type?: string, opts?: { nullable?: boolean; defaultValue?: any }) => void;
    dropColumn: (name: string) => void;
  }) => void): this {
    const api = {
      addColumn: (colName: string, type: string, opts?: { nullable?: boolean; defaultValue?: any }) => {
        this.columnAdds.push({ table: name, col: { name: colName, type, nullable: opts?.nullable ?? true, defaultValue: opts?.defaultValue } });
      },
      alterColumn: (colName: string, type?: string, opts?: { nullable?: boolean; defaultValue?: any }) => {
        const target = { name: colName, type: type ?? 'TEXT', nullable: opts?.nullable ?? true, defaultValue: opts?.defaultValue };
        // Provide a synthetic prev to force emission of ALTER statements when prior state is unknown
        const prev = {
          name: colName,
          type: type ? '__DIFF_FORCE__' : target.type,
          // Flip nullable if provided to ensure difference is detected; otherwise leave undefined
          ...(typeof opts?.nullable === 'boolean' ? { nullable: !opts.nullable } : {})
        } as any;
        this.columnAlters.push({ table: name, col: target as any, prev });
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
    fk: { name?: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }
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
          })) as any,
          primaryKeys: tb.primaryKeys,
          indexes: tb.indexes.map((i) => ({ name: i.name, columns: i.columns, unique: !!i.unique })),
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
    for (const name of this.drops) {
      tables.push({ table: name, drop: true } as any);
    }
    // Column changes
    const byTable = new Map<string, TableDiff>();
    const ensure = (t: string): TableDiff => {
      let td = byTable.get(t);
      if (!td) {
        td = { table: t, columnChanges: [] } as TableDiff;
        byTable.set(t, td);
        tables.push(td);
      }
      return td;
    };
    for (const add of this.columnAdds) {
      ensure(add.table).columnChanges!.push({ kind: 'add', column: { name: add.col.name, type: add.col.type, nullable: add.col.nullable ?? true, defaultValue: add.col.defaultValue } } as any);
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
      } as any);
    }
    for (const drop of this.columnDrops) {
      ensure(drop.table).columnChanges!.push({ kind: 'drop', column: { name: drop.name, type: 'TEXT', nullable: true } } as any);
    }
    // Index creates/drops
    for (const ic of this.indexCreates) {
      const td = ensure(ic.table);
      (td as any).indexCreates = (td as any).indexCreates || [];
      (td as any).indexCreates.push({ name: ic.index.name, columns: ic.index.columns, unique: !!ic.index.unique });
    }
    for (const id of this.indexDrops) {
      const td = ensure(id.table);
      (td as any).indexDrops = (td as any).indexDrops || [];
      (td as any).indexDrops.push(id.name);
    }
    // FK creates/drops
    for (const fc of this.fkCreates) {
      const td = ensure(fc.table);
      (td as any).fkCreates = (td as any).fkCreates || [];
      (td as any).fkCreates.push(fc.fk);
    }
    for (const fd of this.fkDrops) {
      const td = ensure(fd.table);
      (td as any).fkDrops = (td as any).fkDrops || [];
      (td as any).fkDrops.push(fd.name);
    }
    // Renames
    for (const t of this.tableRenames) {
      const td = ensure(t.from);
      (td as any).renameTo = t.to;
    }
    for (const c of this.columnRenames) {
      const td = ensure(c.table);
      (td as any).columnRenames = (td as any).columnRenames || [];
      (td as any).columnRenames.push({ from: c.from, to: c.to });
    }
    return { tables } as SchemaDiff;
  }

  toSql(dialect: Dialect): { up: string[]; down: string[] } {
    return generateMigrationFromDiff(this.toDiff(), dialect);
  }
}


