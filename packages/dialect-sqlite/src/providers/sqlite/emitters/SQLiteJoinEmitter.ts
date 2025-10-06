import type { QueryOptions } from '@ts-linq/core';

export class SQLiteJoinEmitter {
  public emit(options: QueryOptions): string {
    if (!options.joins || options.joins.length === 0) return '';
    let out = '';
    for (const join of options.joins) {
      out += ` ${join.type} JOIN ${join.table}`;
      if (join.alias) out += ` AS ${join.alias}`;
      out += ` ON ${join.on}`;
    }
    return out;
  }
}
