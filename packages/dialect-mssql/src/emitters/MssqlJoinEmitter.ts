import { renderJoinOn } from '@ts-linq/sql-visitor';
import type { QueryOptions } from '@ts-linq/types';

export class MssqlJoinEmitter {
  /**
   * @param quoteIdentifier - The dialect's identifier quoter, used to render structured
   *   `onColumns` join conditions with SQL Server bracket quoting.
   */
  public constructor(private readonly quoteIdentifier: (identifier: string) => string) {}

  public emit(options: QueryOptions): string {
    if (!options.joins || options.joins.length === 0) return '';
    let out = '';
    for (const join of options.joins) {
      out += ` ${join.type} JOIN [${join.table}]`;
      if (join.alias) out += ` AS ${join.alias}`;
      out += ` ON ${renderJoinOn(join, this.quoteIdentifier)}`;
    }
    return out;
  }
}
