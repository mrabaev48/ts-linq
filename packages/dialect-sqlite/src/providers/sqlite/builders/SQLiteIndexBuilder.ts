type LoggerLike = { warn(message: string, error?: unknown): void };

export type SQLiteIndexSpec = {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
  orders?: { [column: string]: 'ASC' | 'DESC' };
  expressions?: string[];
  collations?: { [column: string]: string };
};

export class SQLiteIndexBuilder {
  constructor(private readonly _logger?: LoggerLike) {}

  public buildCreateIndexSql(table: string, index: SQLiteIndexSpec): string {
    if (!index?.name || !Array.isArray(index.columns) || index.columns.length === 0) {
      this._logger?.warn(`SQLite: invalid index spec for ${index?.name || '<unnamed>'}; skip`);
      return '';
    }
    const unique = index.unique ? 'UNIQUE ' : '';
    const whereSql = index.where ? ` WHERE ${index.where}` : '';
    const parts: string[] = [];
    for (const c of index.columns) {
      const ord = index.orders?.[c] ? ` ${index.orders[c]}` : '';
      const collate = index.collations?.[c] ? ` COLLATE ${index.collations[c]}` : '';
      parts.push(`${c}${ord}${collate}`);
    }
    for (const e of index.expressions || []) parts.push(`(${e})`);
    const cols = parts.join(', ');
    return `CREATE ${unique}INDEX IF NOT EXISTS ${index.name} ON ${table} (${cols})${whereSql}`;
  }
}


