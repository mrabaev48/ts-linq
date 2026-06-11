import { emitTagComments } from '@ts-linq/sql-visitor';
import type { QueryOptions, SqlDialect, SqlParameter } from '@ts-linq/types';

import type { QueryModel } from './QueryModel';

/**
 * Cache-agnostic SQL compilation contract. Implemented by both the pure
 * {@link SqlCompilerImpl} and the caching {@link CachingSqlCompiler} decorator,
 * which share the same call signatures so callers are agnostic to caching.
 */
export interface SqlCompiler {
  /** Generate SQL from QueryOptions. */
  generateSql<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] };

  /** Generate SQL from a QueryModel (preferred path). */
  generateFromModel(
    entityClass: new () => unknown,
    model: QueryModel
  ): { query: string; parameters: readonly SqlParameter[] };

  /** Generate a `COUNT(*)` query equivalent to the given model (orderBy/limit/offset/distinct stripped). */
  generateCount(
    entityClass: new () => unknown,
    model: QueryModel
  ): { query: string; parameters: readonly SqlParameter[] };
}

/**
 * Reshape a QueryModel into a count-shaped clone: `SELECT COUNT(*) as count`,
 * with ordering/paging/distinct stripped (irrelevant to a row count).
 */
export function buildCountModel(model: QueryModel): QueryModel {
  const countModel = model.clone();
  countModel.select = ['COUNT(*) as count'];
  countModel.orderBy = undefined;
  countModel.limit = undefined;
  countModel.offset = undefined;
  countModel.distinct = false;
  return countModel;
}

/**
 * Pure, cache-agnostic SQL compiler. Delegates the actual SQL string assembly to the dialect.
 */
export class SqlCompilerImpl implements SqlCompiler {
  constructor(private readonly _dialect: SqlDialect) {}

  public generateSql<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
    // Normalize expressions in select list to strings (dialect can still re-render)
    const normalized: QueryOptions = { ...options };
    if (options.select) {
      normalized.selectParams = [];
      normalized.select = options.select.map((s) => {
        if (typeof s === 'string') return s;
        const expr = s as unknown as {
          toString(): string;
          getParameters?: () => readonly unknown[];
        };
        const sqlStr = expr.toString();
        const params = expr.getParameters?.() ?? [];
        (normalized.selectParams as unknown[]).push(...params);
        return sqlStr;
      });
    }
    return this._dialect.buildSelect(entityClass, normalized);
  }

  public generateFromModel(
    entityClass: new () => unknown,
    model: QueryModel
  ): { query: string; parameters: readonly SqlParameter[] } {
    const opts: QueryOptions = {
      select: model.select,
      where: model.where,
      orderBy: model.orderBy,
      groupBy: model.groupBy,
      joins: model.joins,
      limit: model.limit,
      offset: model.offset,
      distinct: model.distinct,
      from: model.from,
      rawSqlSource: model.rawSqlSource,
      temporal: model.temporal
    };
    const base = this.generateSql(entityClass, opts);

    // Build the final SQL: tags are prepended OUTSIDE the cache so the cache holds clean SQL.
    const tagPrefix = model.tags && model.tags.length > 0 ? emitTagComments(model.tags) : '';

    // Handle UNION / UNION ALL / EXCEPT / INTERSECT chains
    if (model.unions && model.unions.length > 0) {
      let sql = `${base.query}`;
      const params: SqlParameter[] = [...base.parameters];
      for (const unionEntry of model.unions) {
        const next = this.generateFromModel(unionEntry.entity, unionEntry.other);
        const kw = unionEntry.setOp ?? (unionEntry.all ? 'UNION ALL' : 'UNION');
        // Strip any tag prefix from sub-queries before joining (tags belong to the root only)
        const nextSqlBody = next.query;
        sql += ` ${kw} ${nextSqlBody}`;
        params.push(...next.parameters);
      }
      return { query: tagPrefix + sql, parameters: params };
    }

    return { query: tagPrefix + base.query, parameters: base.parameters };
  }

  public generateCount(
    entityClass: new () => unknown,
    model: QueryModel
  ): { query: string; parameters: readonly SqlParameter[] } {
    return this.generateFromModel(entityClass, buildCountModel(model));
  }
}
