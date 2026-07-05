import { renderJoinOn } from '@ts-linq/sql-visitor';
import type { QueryOptions } from '@ts-linq/types';

export class MySqlJoinEmitter {
  /**
   * @param quoteIdentifier - The dialect's identifier quoter, used to render structured
   *   `onColumns` join conditions with MySQL backtick quoting.
   */
  public constructor(private readonly quoteIdentifier: (identifier: string) => string) {}

  public emit(options: QueryOptions): string {
    if (!options.joins || options.joins.length === 0) return '';
    let out = '';
    for (const join of options.joins) {
      out += ` ${join.type} JOIN ${this.quoteIdentifier(join.table)}`;
      if (join.alias) out += ` AS ${join.alias}`;
      out += ` ON ${renderJoinOn(join, this.quoteIdentifier)}`;
    }
    return out;
  }
}
