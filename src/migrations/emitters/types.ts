import type { TableDiff, IndexDef, ForeignKeyDef } from '../DiffTypes';
import type { UniqueConstraintDef } from '../DiffTypes';

export type Dialect = 'sqlite' | 'postgresql' | 'mysql' | 'mssql';

export interface DialectSqlEmitter {
  q(id: string): string;
  dropIndex(table: string, name: string): string;
  createIndex(table: string, def: IndexDef): string;
  mapType(t: string): string;
  mapTypeWithModifiers(c: {
    type: string;
    length?: number;
    precision?: number;
    scale?: number;
  }): string;
  alterNull(table: string, name: string, nullable: boolean): string;
  alterType(table: string, name: string, newTypeSql: string): string;
  formatValue(v: unknown): string;
  alterDefault(table: string, name: string, newDefault: unknown | undefined): string[];
  createTable(td: TableDiff): string;
  dropTable(name: string): string;
  renameTable(oldName: string, newName: string): string;
  addColumn(table: string, name: string, type: string, nullable: boolean, def?: unknown): string;
  dropColumn(table: string, name: string): string;
  addForeignKey(table: string, fk: ForeignKeyDef): string;
  dropForeignKey(table: string, name: string): string;
  createUniqueConstraint(table: string, def: UniqueConstraintDef): string;
  dropUniqueConstraint(table: string, name: string): string;
  addCheckConstraint(table: string, def: { name?: string; expression: string }): string;
  dropCheckConstraint(table: string, name: string): string;
  renameConstraint(table: string, oldName: string, newName: string): string;
}
