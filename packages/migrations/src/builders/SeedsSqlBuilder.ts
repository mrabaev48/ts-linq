import type { Dialect } from '../Dialect';
import type { SeedRowOp } from '../DiffTypes';
import { formatValue, q } from './SqlUtils';

export class SeedsSqlBuilder {
  constructor(private readonly dialect: Dialect) {}

  public generate(ops: SeedRowOp[], up: string[], down: string[]): void {
    for (const op of ops) {
      switch (op.kind) {
        case 'insert':
          up.push(this.buildInsert(op.table, op.row));
          down.push(this.buildDelete(op.table, op.pkColumns, op.row));
          break;
        case 'update':
          up.push(this.buildUpdate(op.table, op.pkColumns, op.row));
          down.push(this.buildUpdate(op.table, op.pkColumns, op.prev));
          break;
        case 'delete':
          up.push(this.buildDelete(op.table, op.pkColumns, op.row));
          down.push(this.buildInsert(op.table, op.row));
          break;
      }
    }
  }

  private buildInsert(table: string, row: Record<string, unknown>): string {
    const cols = Object.keys(row).map((c) => q(this.dialect, c));
    const vals = Object.values(row).map((v) => formatValue(this.dialect, v));
    return `INSERT INTO ${q(this.dialect, table)} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
  }

  private buildUpdate(table: string, pkColumns: string[], row: Record<string, unknown>): string {
    const setParts = Object.keys(row)
      .filter((c) => !pkColumns.includes(c))
      .map((c) => `${q(this.dialect, c)} = ${formatValue(this.dialect, row[c])}`);
    if (setParts.length === 0) {
      // All columns are PKs — nothing to update; skip silently
      return `-- UPDATE ${q(this.dialect, table)}: no non-PK columns to update`;
    }
    const whereParts = pkColumns.map(
      (c) => `${q(this.dialect, c)} = ${formatValue(this.dialect, row[c])}`
    );
    return `UPDATE ${q(this.dialect, table)} SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`;
  }

  private buildDelete(table: string, pkColumns: string[], row: Record<string, unknown>): string {
    const whereParts = pkColumns.map(
      (c) => `${q(this.dialect, c)} = ${formatValue(this.dialect, row[c])}`
    );
    return `DELETE FROM ${q(this.dialect, table)} WHERE ${whereParts.join(' AND ')}`;
  }
}
