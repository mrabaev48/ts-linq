/**
 * Minimal SQL window/functions DSL to help build expressions in a type-safe-ish way
 * without coupling to predicate parser. String-based columns to keep it simple.
 */

export type OrderDirection = 'ASC' | 'DESC';

class WindowBuilder {
  private readonly funcCall: string;
  private partitions: string[] = [];
  private orders: Array<{ column: string; direction: OrderDirection }> = [];

  constructor(funcCall: string) {
    this.funcCall = funcCall;
  }

  partitionBy(columns: string | string[]): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.partitions.push(...cols);
    return this;
  }

  orderBy(column: string, direction: OrderDirection = 'ASC'): this {
    this.orders.push({ column, direction });
    return this;
  }

  toString(): string {
    const parts: string[] = [];
    if (this.partitions.length) parts.push(`PARTITION BY ${this.partitions.join(', ')}`);
    if (this.orders.length)
      parts.push(`ORDER BY ${this.orders.map((o) => `${o.column} ${o.direction}`).join(', ')}`);
    return `${this.funcCall} OVER (${parts.join(' ')})`;
  }

  as(alias: string): string {
    return `${this.toString()} AS ${alias}`;
  }
}

class RankFunction {
  over(): WindowBuilder {
    return new WindowBuilder('RANK()');
  }
}

class DenseRankFunction {
  over(): WindowBuilder {
    return new WindowBuilder('DENSE_RANK()');
  }
}

class RowNumberFunction {
  over(): WindowBuilder {
    return new WindowBuilder('ROW_NUMBER()');
  }
}

export const sql = {
  rank(): RankFunction {
    return new RankFunction();
  },
  denseRank(): DenseRankFunction {
    return new DenseRankFunction();
  },
  rowNumber(): RowNumberFunction {
    return new RowNumberFunction();
  },
  // JSON helpers (dialect-specific rendering expected downstream)
  jsonExtract(column: string, path: string): ExprBuilder {
    // Postgres: column #>> '{a,b}', MySQL: JSON_EXTRACT(column, '$.a.b')
    return new ExprBuilder(`JSON_EXTRACT(${column}, ?)`, [path]);
  },
  jsonContains(column: string, json: string | number | boolean): ExprBuilder {
    return new ExprBuilder(`JSON_CONTAINS(${column}, ?)`, [json]);
  },
  // Full-text search DSL (vendor-aware by convention; dialect may remap)
  mysqlMatchAgainst(
    columns: string | string[],
    query: string,
    mode: 'natural' | 'boolean' | 'query expansion' = 'natural'
  ): ExprBuilder {
    const cols = Array.isArray(columns) ? columns.join(', ') : columns;
    const modeSql =
      mode === 'boolean'
        ? ' IN BOOLEAN MODE'
        : mode === 'query expansion'
          ? ' WITH QUERY EXPANSION'
          : ' IN NATURAL LANGUAGE MODE';
    return new ExprBuilder(`MATCH(${cols}) AGAINST (?${modeSql})`, [query]);
  },
  pgToTsVector(columns: string | string[], config: string = 'simple'): ExprBuilder {
    const cols = Array.isArray(columns) ? columns : [columns];
    const coalesced = cols.map((c) => `COALESCE(${c}, '')`).join(` || ' ' || `);
    return new ExprBuilder(`to_tsvector(?, ${coalesced})`, [config]);
  },
  pgPlainToTsQuery(query: string, config: string = 'simple'): ExprBuilder {
    return new ExprBuilder(`plainto_tsquery(?, ?)`, [config, query]);
  },
  pgWebsearchToTsQuery(query: string, config: string = 'simple'): ExprBuilder {
    return new ExprBuilder(`websearch_to_tsquery(?, ?)`, [config, query]);
  },
  pgRank(vectorExpr: string, queryExpr: string): ExprBuilder {
    return new ExprBuilder(`ts_rank(${vectorExpr}, ${queryExpr})`);
  }
};

export type SqlWindow = WindowBuilder;

import type { SqlExpression } from '../types';

class ExprBuilder implements SqlExpression {
  private readonly expr: string;
  private readonly params: unknown[];
  constructor(expr: string, params: unknown[] = []) {
    this.expr = expr;
    this.params = params;
  }
  toString(): string {
    return this.expr;
  }
  getParameters(): readonly unknown[] {
    return this.params;
  }
  as(alias: string): ExprBuilder {
    return new ExprBuilder(`${this.expr} AS ${alias}`, this.params);
  }
}
