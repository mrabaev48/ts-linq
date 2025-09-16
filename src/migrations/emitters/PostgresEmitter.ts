import { BaseEmitter } from './BaseEmitter';

export class PostgresEmitter extends BaseEmitter {
  public override q(id: string): string {
    return '"' + id + '"';
  }
  public override dropIndex(_table: string, name: string): string {
    return `DROP INDEX ${this.q(name)}`;
  }
  public override createTable(td: import('../DiffTypes').TableDiff): string {
    // PG: delegate to BaseEmitter which already emits CONSTRAINT for UNIQUE/CHECK/FK/PK
    return super.createTable(td);
  }
  public override mapType(t: string): string {
    const up = String(t || '').toUpperCase();
    if (up === 'INTEGER' || up === 'NUMBER') return 'INTEGER';
    if (up === 'TEXT' || up === 'STRING') return 'TEXT';
    if (up === 'BOOLEAN') return 'BOOLEAN';
    if (up === 'DATETIME' || up === 'DATE') return 'TIMESTAMPTZ';
    if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE') return 'DOUBLE PRECISION';
    return up;
  }
  public override alterNull(table: string, name: string, nullable: boolean): string {
    return `ALTER TABLE ${this.q(table)} ALTER COLUMN ${this.q(name)} ${nullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`;
  }
  public override alterType(table: string, name: string, newTypeSql: string): string {
    return `ALTER TABLE ${this.q(table)} ALTER COLUMN ${this.q(name)} TYPE ${newTypeSql}`;
  }
  public override formatValue(v: unknown): string {
    if (v === null) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (v instanceof Date) return `'${v.toISOString()}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  }
  public override dropColumn(table: string, name: string): string {
    return `ALTER TABLE ${this.q(table)} DROP COLUMN ${this.q(name)}`;
  }
  public override dropTable(name: string): string {
    return `DROP TABLE ${this.q(name)}`;
  }
  public override renameTable(oldName: string, newName: string): string {
    return `ALTER TABLE ${this.q(oldName)} RENAME TO ${this.q(newName)}`;
  }
  public override alterDefault(
    table: string,
    name: string,
    newDefault: unknown | undefined
  ): string[] {
    const set =
      newDefault !== undefined ? `SET DEFAULT ${this.formatValue(newDefault)}` : 'DROP DEFAULT';
    return [`ALTER TABLE ${this.q(table)} ALTER COLUMN ${this.q(name)} ${set}`];
  }
  public override createIndex(table: string, def: import('../DiffTypes').IndexDef): string {
    const uniq = def.unique ? 'UNIQUE ' : '';
    const cols = def.columns.map((c) => this.q(c)).join(', ');
    return `CREATE ${uniq}INDEX ${this.q(def.name)} ON ${this.q(table)} (${cols})`;
  }
  public override addForeignKey(table: string, fk: import('../DiffTypes').ForeignKeyDef): string {
    const name = fk.name ? `CONSTRAINT ${this.q(fk.name)} ` : '';
    const cols = fk.columns.map((c) => this.q(c)).join(', ');
    const refCols = fk.refColumns.map((c) => this.q(c)).join(', ');
    const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
    const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
    return `ALTER TABLE ${this.q(table)} ADD ${name}FOREIGN KEY (${cols}) REFERENCES ${this.q(fk.refTable)} (${refCols})${onDel}${onUpd}`;
  }
  public override dropForeignKey(table: string, name: string): string {
    return `ALTER TABLE ${this.q(table)} DROP CONSTRAINT ${this.q(name)}`;
  }
  public override createUniqueConstraint(
    table: string,
    def: { name?: string; columns: string[] }
  ): string {
    const name = def.name || `UQ_${table}_${def.columns.join('_')}`;
    return `ALTER TABLE ${this.q(table)} ADD CONSTRAINT ${this.q(name)} UNIQUE (${def.columns.map((c) => this.q(c)).join(', ')})`;
  }
  public override dropUniqueConstraint(table: string, name: string): string {
    return `ALTER TABLE ${this.q(table)} DROP CONSTRAINT ${this.q(name)}`;
  }
  public override addCheckConstraint(
    table: string,
    def: { name?: string; expression: string }
  ): string {
    const name = def.name ? ` CONSTRAINT ${this.q(def.name)}` : '';
    return `ALTER TABLE ${this.q(table)} ADD${name} CHECK (${def.expression})`;
  }
  public override dropCheckConstraint(table: string, name: string): string {
    return `ALTER TABLE ${this.q(table)} DROP CONSTRAINT ${this.q(name)}`;
  }
  public override renameConstraint(table: string, oldName: string, newName: string): string {
    return `ALTER TABLE ${this.q(table)} RENAME CONSTRAINT ${this.q(oldName)} TO ${this.q(newName)}`;
  }
}
