import { quoteIdentifier } from '../quoting';

type LoggerLike = { warn(message: string, error?: unknown): void };

export type MySqlIndexSpec = {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
  orders?: { [column: string]: 'ASC' | 'DESC' };
  expressions?: string[];
  nulls?: { [column: string]: 'FIRST' | 'LAST' };
  mysqlType?: 'FULLTEXT' | 'SPATIAL';
  mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
};

export class MySqlIndexBuilder {
  constructor(private readonly logger?: LoggerLike) {}

  public buildCreateIndexSql(table: string, index: MySqlIndexSpec): string {
    if (!this.isValidIndexSpec(index)) {
      this.logger?.warn(`MySQL: invalid index spec for ${index?.name || '<unnamed>'}; skip`);
      return '';
    }
    this.warnUnsupportedOptions(index);
    const kind = this.buildKind(index);
    const cols = this.buildColumnsList(index);
    const vis = index.mysqlVisibility ? ` ${index.mysqlVisibility}` : '';
    return `CREATE ${kind}INDEX IF NOT EXISTS ${quoteIdentifier(index.name)} ON ${quoteIdentifier(table)} (${cols})${vis}`;
  }

  private isValidIndexSpec(index: {
    name?: string;
    columns?: string[];
    expressions?: string[];
  }): boolean {
    if (!index || !index.name) return false;
    const hasColumns = Array.isArray(index.columns) && index.columns.length > 0;
    const hasExpr = Array.isArray(index.expressions) && index.expressions.length > 0;
    return hasColumns || hasExpr;
  }

  private warnUnsupportedOptions(index: { name: string; where?: string; nulls?: object }): void {
    if (index.where) {
      this.logger?.warn(
        `MySQL: partial index WHERE is not supported and will be ignored for ${index.name}`
      );
    }
    if (index.nulls && Object.keys(index.nulls).length > 0) {
      this.logger?.warn(
        `MySQL: NULLS FIRST/LAST is not supported and will be ignored for ${index.name}`
      );
    }
  }

  private buildKind(index: { unique: boolean; mysqlType?: 'FULLTEXT' | 'SPATIAL' }): string {
    if (index.mysqlType) return `${index.mysqlType} `;
    return index.unique ? 'UNIQUE ' : '';
  }

  private buildColumnsList(index: {
    columns: string[];
    orders?: Record<string, 'ASC' | 'DESC'>;
    expressions?: string[];
  }): string {
    const parts: string[] = [];
    for (const c of index.columns)
      parts.push(
        index.orders?.[c] ? `${quoteIdentifier(c)} ${index.orders[c]}` : quoteIdentifier(c)
      );
    for (const e of index.expressions || []) parts.push(`(${e})`);
    return parts.join(', ');
  }
}
