import { BaseEmitter } from './BaseEmitter';

export class MssqlEmitter extends BaseEmitter {
  public override q(id: string): string {
    return '[' + id + ']';
  }
  public override dropIndex(table: string, name: string): string {
    return `DROP INDEX ${this.q(table)}.${this.q(name)}`;
  }
  public override mapType(t: string): string {
    const up = String(t || '').toUpperCase();
    if (up === 'INTEGER' || up === 'NUMBER') return 'INT';
    if (up === 'TEXT' || up === 'STRING') return 'NVARCHAR(MAX)';
    if (up === 'BOOLEAN') return 'BIT';
    if (up === 'DATETIME' || up === 'DATE') return 'DATETIME2';
    if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE') return 'FLOAT';
    return up;
  }
  public override alterNull(_table: string, _name: string, _nullable: boolean): string {
    return `-- MSSQL requires full type in ALTER COLUMN for nullability; include in type alter`;
  }
  public override alterType(table: string, name: string, newTypeSql: string): string {
    return `ALTER TABLE ${this.q(table)} ALTER COLUMN ${this.q(name)} ${newTypeSql}`;
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
    return `ALTER TABLE ${tableQ} ADD ${colQ} ${typeSql}${nn}${d}`;
  }
  public override dropColumn(table: string, name: string): string {
    return `ALTER TABLE ${this.q(table)} DROP COLUMN ${this.q(name)}`;
  }
  public override dropTable(name: string): string {
    return `DROP TABLE ${this.q(name)}`;
  }
  public override renameTable(oldName: string, newName: string): string {
    return `EXEC sp_rename '${oldName}', '${newName}'`;
  }
  public override alterDefault(
    table: string,
    name: string,
    newDefault: unknown | undefined
  ): string[] {
    const drop = `DECLARE @dc sysname; SELECT @dc = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('${table}') AND c.name = '${name}'; IF @dc IS NOT NULL EXEC('ALTER TABLE ${this.q(table)} DROP CONSTRAINT ' + QUOTENAME(@dc))`;
    const stmts = [drop];
    if (newDefault !== undefined) {
      const dfName = `DF_${table}_${name}`;
      stmts.push(
        `ALTER TABLE ${this.q(table)} ADD CONSTRAINT ${this.q(dfName)} DEFAULT ${this.formatValue(newDefault)} FOR ${this.q(name)}`
      );
    }
    return stmts;
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
    const cols = def.columns.map((c) => this.q(c)).join(', ');
    return `ALTER TABLE ${this.q(table)} ADD CONSTRAINT ${this.q(name)} UNIQUE (${cols})`;
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
    return `EXEC sp_rename '${table}.${oldName}', '${newName}', 'OBJECT'`;
  }
}
