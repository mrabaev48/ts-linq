import type { TableDiff } from '../DiffTypes';
import type { DialectSqlEmitter } from './types';
import type { IndexDef, ForeignKeyDef } from '../DiffTypes';

export class BaseEmitter implements DialectSqlEmitter {
  public q(id: string): string { return id; }
  public dropIndex(_table: string, name: string): string { return `DROP INDEX ${this.q(name)}`; }
  public mapType(t: string): string {
    const up = String(t || '').toUpperCase();
    if (up === 'INTEGER' || up === 'NUMBER') return 'INTEGER';
    if (up === 'TEXT' || up === 'STRING') return 'TEXT';
    if (up === 'BOOLEAN') return 'INTEGER';
    if (up === 'DATETIME' || up === 'DATE') return 'TEXT';
    if (up === 'REAL' || up === 'FLOAT' || up === 'DOUBLE') return 'REAL';
    return up;
  }
  public mapTypeWithModifiers(c: { type: string; length?: number; precision?: number; scale?: number }): string {
    const base = this.mapType(c.type);
    if (c.precision !== undefined && c.scale !== undefined && (base === 'REAL' || base === 'DECIMAL' || base === 'NUMERIC' || base === 'FLOAT' || base === 'DOUBLE')) {
      return `${base}(${c.precision},${c.scale})`;
    }
    if (c.length !== undefined && (base === 'TEXT' || base === 'STRING' || base === 'VARCHAR' || base.startsWith('NVARCHAR'))) {
      return `${base}(${c.length})`;
    }
    return base;
  }
  public alterNull(_table: string, _name: string, _nullable: boolean): string {
    return `-- SQLite nullability alter requires rebuild`;
  }
  public alterType(_table: string, name: string, newTypeSql: string): string {
    return `-- SQLite type alter requires rebuild: ${name} ${newTypeSql}`;
  }
  public formatValue(v: unknown): string {
    if (v === null) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v instanceof Date) return `'${v.toISOString()}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  }
  public alterDefault(_table: string, name: string, newDefault: unknown | undefined): string[] {
    // SQLite requires rebuild; return informational comment for consistency with interface
    return [`-- SQLite default change requires table rebuild for ${name}`];
  }
  public createTable(td: TableDiff): string {
    const create = td.create!;
    const defs: string[] = [];
    defs.push(
      ...create.columns.map((c) => `${this.q(c.name)} ${this.mapType(c.type)}${c.nullable ? '' : ' NOT NULL'}${c.defaultValue !== undefined ? ' DEFAULT ' + this.formatValue(c.defaultValue) : ''}`)
    );
    if (create.primaryKeys && create.primaryKeys.length > 0)
      defs.push(`PRIMARY KEY (${create.primaryKeys.map((pk) => this.q(pk)).join(', ')})`);
    if (create.uniqueConstraints && create.uniqueConstraints.length > 0) {
      for (const uq of create.uniqueConstraints) {
        const name = uq.name ? `CONSTRAINT ${this.q(uq.name)} ` : '';
        const cols = uq.columns.map((c) => this.q(c)).join(', ');
        defs.push(`${name}UNIQUE (${cols})`);
      }
    }
    if (create.checkConstraints && create.checkConstraints.length > 0) {
      for (const ck of create.checkConstraints) {
        const name = ck.name ? `CONSTRAINT ${this.q(ck.name)} ` : '';
        defs.push(`${name}CHECK (${ck.expression})`);
      }
    }
    if (create.foreignKeys && create.foreignKeys.length > 0) {
      for (const fk of create.foreignKeys) {
        const name = fk.name ? `CONSTRAINT ${this.q(fk.name)} ` : '';
        const colsList = fk.columns.map((c) => this.q(c)).join(', ');
        const refCols = fk.refColumns.map((c) => this.q(c)).join(', ');
        const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
        const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
        defs.push(`${name}FOREIGN KEY (${colsList}) REFERENCES ${this.q(fk.refTable)} (${refCols})${onDel}${onUpd}`);
      }
    }
    return `CREATE TABLE IF NOT EXISTS ${this.q(create.name)} (${defs.join(', ')})`;
  }
  public dropTable(name: string): string {
    return `DROP TABLE ${this.q(name)}`;
  }
  public renameTable(oldName: string, newName: string): string {
    return `ALTER TABLE ${this.q(oldName)} RENAME TO ${this.q(newName)}`;
  }
  public addColumn(table: string, name: string, type: string, nullable: boolean, def?: unknown): string {
    const tableQ = this.q(table);
    const colQ = this.q(name);
    const typeSql = this.mapType(type);
    const nn = nullable ? '' : ' NOT NULL';
    const d = def !== undefined ? ` DEFAULT ${this.formatValue(def)}` : '';
    const kw = 'ADD COLUMN';
    return `ALTER TABLE ${tableQ} ${kw} ${colQ} ${typeSql}${nn}${d}`;
  }
  public dropColumn(_table: string, name: string): string {
    return `-- DROP COLUMN ${name} is not supported directly in SQLite`;
  }
  public createIndex(table: string, def: IndexDef): string {
    const uniq = def.unique ? 'UNIQUE ' : '';
    const cols = def.columns.map((c) => this.q(c)).join(', ');
    return `CREATE ${uniq}INDEX ${this.q(def.name)} ON ${this.q(table)} (${cols})`;
  }
  public addForeignKey(table: string, fk: ForeignKeyDef): string {
    const name = fk.name ? `CONSTRAINT ${this.q(fk.name)} ` : '';
    const cols = fk.columns.map((c) => this.q(c)).join(', ');
    const refCols = fk.refColumns.map((c) => this.q(c)).join(', ');
    const onDel = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
    const onUpd = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
    return `-- SQLite requires table rebuild to add FK: ${name}(${cols}) -> ${fk.refTable}(${refCols})${onDel}${onUpd}`;
  }
  public dropForeignKey(_table: string, name: string): string {
    return `-- SQLite requires table rebuild to drop FK: ${name}`;
  }
  public createUniqueConstraint(table: string, def: { name?: string; columns: string[] }): string {
    const idxName = def.name || `UQ_${table}_${def.columns.join('_')}`;
    return `CREATE UNIQUE INDEX IF NOT EXISTS ${idxName} ON ${this.q(table)} (${def.columns.join(', ')})`;
  }
  public dropUniqueConstraint(_table: string, name: string): string {
    return `DROP INDEX IF EXISTS ${name}`;
  }
  public addCheckConstraint(_table: string, def: { name?: string; expression: string }): string {
    const nm = def.name ? `${def.name}: ` : '';
    return `-- SQLite does not support ADD CHECK post-create (${nm}${def.expression})`;
  }
  public dropCheckConstraint(_table: string, name: string): string {
    return `-- SQLite does not support DROP CHECK ${name} post-create`;
  }
}


