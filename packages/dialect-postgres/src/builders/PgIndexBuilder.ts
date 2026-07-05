import { quoteIdentifier } from '../quoting';

type LoggerLike = { warn(message: string, error?: unknown): void };

export type PgIndexSpec = {
  name: string;
  columns: string[];
  unique: boolean;
  where?: string;
  orders?: { [column: string]: 'ASC' | 'DESC' };
  expressions?: string[];
  collations?: { [column: string]: string };
  nulls?: { [column: string]: 'FIRST' | 'LAST' };
  using?: 'btree' | 'hash' | 'gin' | 'gist';
  concurrently?: boolean;
  withParams?: Record<string, string | number | boolean>;
};

export class PgIndexBuilder {
  constructor(private readonly logger?: LoggerLike) {}

  public buildCreateIndexSql(table: string, index: PgIndexSpec): string {
    if (!this.isValidIndexSpec(index)) {
      this.logger?.warn(`Postgres: invalid index spec for ${index?.name || '<unnamed>'}; skip`);
      return '';
    }
    this.warnIfCollationWithNonBtree(index);
    const uniqueKeyword = this.buildUniqueKeyword(index);
    const concurrently = this.buildConcurrently(index);
    const using = this.buildUsing(index);
    const columnsListSql = this.buildIndexColumnsList(index);
    const withSql = this.buildWithParams(index.withParams);
    const whereSql = this.buildWhere(index);
    return this.composeCreateIndexSql(
      table,
      index.name,
      uniqueKeyword,
      concurrently,
      using,
      columnsListSql,
      withSql,
      whereSql
    );
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

  private warnIfCollationWithNonBtree(index: {
    name: string;
    using?: 'btree' | 'hash' | 'gin' | 'gist';
    collations?: { [column: string]: string };
  }): void {
    const hasCollations = !!index.collations && Object.keys(index.collations).length > 0;
    const method = index.using || 'btree';
    if (hasCollations && method !== 'btree') {
      this.logger?.warn(
        `Postgres: COLLATE is only meaningful with BTREE; using=${method} for index ${index.name}`
      );
    }
  }

  private buildIndexColumnsList(index: {
    columns: string[];
    orders?: { [column: string]: 'ASC' | 'DESC' };
    collations?: { [column: string]: string };
    nulls?: { [column: string]: 'FIRST' | 'LAST' };
    expressions?: string[];
  }): string {
    const parts: string[] = [];
    for (const col of index.columns) parts.push(this.formatIndexColumn(col, index));
    for (const expr of index.expressions || []) parts.push(`(${expr})`);
    return parts.join(', ');
  }

  private buildWithParams(withParams?: Record<string, string | number | boolean>): string {
    if (!withParams || Object.keys(withParams).length === 0) return '';
    const body = Object.entries(withParams)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? `'${v}'` : String(v)}`)
      .join(', ');
    return ` WITH (${body})`;
  }

  private formatIndexColumn(
    column: string,
    index: {
      orders?: { [column: string]: 'ASC' | 'DESC' };
      collations?: { [column: string]: string };
      nulls?: { [column: string]: 'FIRST' | 'LAST' };
    }
  ): string {
    const ord = index.orders?.[column] ? ` ${index.orders[column]}` : '';
    const coll = index.collations?.[column] ? ` COLLATE ${index.collations[column]}` : '';
    const nulls = index.nulls?.[column] ? ` NULLS ${index.nulls[column]}` : '';
    return `${quoteIdentifier(column)}${ord}${coll}${nulls}`;
  }

  private buildUniqueKeyword(index: { unique: boolean }): string {
    return index.unique ? 'UNIQUE ' : '';
  }

  private buildConcurrently(index: { concurrently?: boolean }): string {
    return index.concurrently ? ' CONCURRENTLY' : '';
  }

  private buildUsing(index: { using?: 'btree' | 'hash' | 'gin' | 'gist' }): string {
    return index.using ? ` USING ${index.using.toUpperCase()}` : '';
  }

  private buildWhere(index: { where?: string }): string {
    return index.where ? ` WHERE ${index.where}` : '';
  }

  private composeCreateIndexSql(
    table: string,
    name: string,
    unique: string,
    concurrently: string,
    using: string,
    columnsListSql: string,
    withSql: string,
    whereSql: string
  ): string {
    return `CREATE ${unique}INDEX${concurrently} IF NOT EXISTS ${quoteIdentifier(name)} ON ${quoteIdentifier(table)}${using} (${columnsListSql})${withSql}${whereSql}`;
  }
}
