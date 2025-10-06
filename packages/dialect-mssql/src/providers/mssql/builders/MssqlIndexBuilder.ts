type LoggerLike = { warn(message: string, error?: unknown): void };

export type MssqlIndexSpec = {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
  orders?: { [column: string]: 'ASC' | 'DESC' };
  include?: string[];
  expressions?: string[];
  collations?: { [column: string]: string };
  nulls?: { [column: string]: 'FIRST' | 'LAST' };
};

export class MssqlIndexBuilder {
  constructor(private readonly logger?: LoggerLike) {}

  public buildCreateIndexSql(table: string, index: MssqlIndexSpec): string {
    if (!this.isValid(index)) {
      this.logger?.warn(`MSSQL: invalid index spec for ${index?.name || '<unnamed>'}; skip`);
      return '';
    }
    this.warnUnsupported(index);
    const unique = index.unique ? 'UNIQUE ' : '';
    const cols = index.columns
      .map((c) => (index.orders?.[c] ? `${c} ${index.orders[c]}` : c))
      .join(', ');
    const include =
      index.include && index.include.length > 0 ? ` INCLUDE (${index.include.join(', ')})` : '';
    const whereSql = index.where ? ` WHERE ${index.where}` : '';
    return `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${index.name}' AND object_id=OBJECT_ID('${table}')) CREATE ${unique}INDEX ${index.name} ON ${table} (${cols})${include}${whereSql}`;
  }

  private isValid(index: { name?: string; columns?: string[] }): boolean {
    return !!index?.name && Array.isArray(index.columns) && index.columns.length > 0;
  }

  private warnUnsupported(index: MssqlIndexSpec): void {
    const unexpected: string[] = [];
    if (index.expressions && index.expressions.length > 0) unexpected.push('expressions');
    if (index.collations && Object.keys(index.collations).length > 0) unexpected.push('collations');
    if (index.nulls && Object.keys(index.nulls).length > 0) unexpected.push('nulls');
    if (unexpected.length > 0) {
      this.logger?.warn(
        `MSSQL: unsupported index options ignored for ${index.name}: ${unexpected.join(', ')}`
      );
    }
  }
}
