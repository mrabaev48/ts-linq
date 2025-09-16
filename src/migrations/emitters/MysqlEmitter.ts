import { BaseEmitter } from './BaseEmitter';

export class MysqlEmitter extends BaseEmitter {
  public override q(id: string): string {
    return '`' + id + '`';
  }
  public override dropIndex(table: string, name: string): string {
    return `DROP INDEX ${this.q(name)} ON ${this.q(table)}`;
  }
  public override createTable(td: import('../DiffTypes').TableDiff): string {
    // MySQL: BaseEmitter's CREATE TABLE with CONSTRAINT clauses is valid
    return super.createTable(td);
  }
  public override mapType(t: string): string {
    const up = String(t || '').toUpperCase();
    if (up === 'INTEGER' || up === 'NUMBER') return 'INT';
    if (up === 'TEXT' || up === 'STRING') return 'TEXT';
    if (up === 'BOOLEAN') return 'TINYINT(1)';
    if (up === 'DATETIME' || up === 'DATE') return 'DATETIME';
    if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE') return 'DOUBLE';
    return up;
  }
  public override alterNull(_table: string, _name: string, _nullable: boolean): string {
    return `-- MySQL requires full type in MODIFY for nullability; include in type alter`;
  }
  public override alterType(table: string, name: string, newTypeSql: string): string {
    return `ALTER TABLE ${this.q(table)} MODIFY COLUMN ${this.q(name)} ${newTypeSql}`;
  }
  public override addColumn(
    table: string,
    name: string,
    type: string,
    nullable: boolean,
    def?: unknown
  ): string {
    const tableQ = this.q(table);
    const colQ = this.q(name);
    const typeSql = this.mapType(type);
    const nn = nullable ? '' : ' NOT NULL';
    const d = def !== undefined ? ` DEFAULT ${this.formatValue(def)}` : '';
    return `ALTER TABLE ${tableQ} ADD COLUMN ${colQ} ${typeSql}${nn}${d}`;
  }
  public override dropColumn(table: string, name: string): string {
    return `ALTER TABLE ${this.q(table)} DROP COLUMN ${this.q(name)}`;
  }
  public override dropTable(name: string): string {
    return `DROP TABLE ${this.q(name)}`;
  }
  public override renameTable(oldName: string, newName: string): string {
    return `RENAME TABLE ${this.q(oldName)} TO ${this.q(newName)}`;
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
    return `ALTER TABLE ${this.q(table)} DROP FOREIGN KEY ${this.q(name)}`;
  }
  public override createUniqueConstraint(
    table: string,
    def: { name?: string; columns: string[] }
  ): string {
    const name = def.name || `UQ_${table}_${def.columns.join('_')}`;
    return `ALTER TABLE ${this.q(table)} ADD CONSTRAINT ${this.q(name)} UNIQUE (${def.columns.map((c) => this.q(c)).join(', ')})`;
  }
  public override dropUniqueConstraint(table: string, name: string): string {
    return `ALTER TABLE ${this.q(table)} DROP INDEX ${this.q(name)}`;
  }
  public override addCheckConstraint(
    _table: string,
    def: { name?: string; expression: string }
  ): string {
    // Best-effort: MySQL historically had limited CHECK support
    const nm = def.name ? `${def.name}: ` : '';
    return `-- MySQL CHECK support is limited: (${nm}${def.expression})`;
  }
  public override dropCheckConstraint(_table: string, name: string): string {
    return `-- MySQL drop CHECK not standardized for older versions: ${name}`;
  }
  public override renameConstraint(table: string, oldName: string, newName: string): string {
    // MySQL: UNIQUE is an index; CHECK rename is not standardized → advise drop/create
    return `-- MySQL does not support RENAME CONSTRAINT reliably; drop/create ${oldName} -> ${newName}`;
  }
}
