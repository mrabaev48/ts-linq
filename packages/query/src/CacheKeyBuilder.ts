import type { QueryOptions, SqlParameter } from '@ts-linq/types';

/**
 * Pure cache-key construction for SQL generation caching.
 *
 * Extracted from `QueryBuilder` so key/plan-key derivation and current-parameter
 * extraction can be unit-tested in isolation from any cache or dialect.
 */
export class CacheKeyBuilder {
  /** Create a stable, lightweight cache key. */
  public static build<T>(
    entityClass: new () => T,
    options: QueryOptions,
    providerName?: string,
    namespace?: string
  ): string {
    const parts: string[] = [];
    if (namespace) parts.push(namespace, '|');
    if (providerName) parts.push(providerName, '|');
    parts.push(entityClass.name);
    parts.push('|s:', options.select ? options.select.join(',') : '');
    const whereArray = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : [];
    if (whereArray.length) parts.push('|w:', CacheKeyBuilder.serializeWhere(options));
    if (options.orderBy?.length) parts.push('|o:', CacheKeyBuilder.serializeOrderBy(options));
    if (options.groupBy) parts.push('|g:', CacheKeyBuilder.serializeGroupBy(options));
    if (options.joins?.length) parts.push('|j:', CacheKeyBuilder.serializeJoins(options));
    if (options.limit !== undefined) parts.push('|l:', String(options.limit));
    if (options.offset !== undefined) parts.push('|f:', String(options.offset));
    if (options.distinct) parts.push('|d:1');
    return parts.join('');
  }

  /**
   * Build a structure-only plan key by stripping parameter values from a full cache key.
   * Used by the plan-level (TemplateSqlCache) code path.
   */
  public static buildPlanKey(fullKey: string): string {
    return fullKey
      .replace(/\?\(([^)]*)\)/g, '?()') // strip ?(val) after ? placeholders
      .replace(/\)\(([^()]*)\)/g, ')()'); // strip )(val) groups (whereIn / IN-clause params)
  }

  /**
   * Re-extract all current SQL parameters from QueryOptions.
   * Called when a plan-cache hit is found so the cached SQL template is reused
   * but fresh parameter values are bound for this invocation.
   */
  public static extractCurrentParams(options: QueryOptions): SqlParameter[] {
    const params: SqlParameter[] = [];
    const wheres = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : [];
    for (const w of wheres) {
      if (w.parameters) params.push(...w.parameters);
    }
    if (options.groupBy && !Array.isArray(options.groupBy) && options.groupBy.having?.parameters) {
      params.push(...options.groupBy.having.parameters);
    }
    if (options.rawSqlSource) {
      params.push(...options.rawSqlSource.params);
    }
    if (options.selectParams) {
      params.push(...(options.selectParams as SqlParameter[]));
    }
    return params;
  }

  private static serializeWhere(options: QueryOptions): string {
    const whereArray = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : [];
    return whereArray.map((w) => `${w.condition}(${w.parameters?.join('|') ?? ''})`).join('');
  }

  private static serializeOrderBy(options: QueryOptions): string {
    return (options.orderBy ?? []).map((o) => `${o.column}:${o.direction};`).join('');
  }

  private static serializeGroupBy(options: QueryOptions): string {
    const gb = options.groupBy!;
    if (Array.isArray(gb)) {
      return gb.join(',');
    }
    const base = gb.columns.join(',');
    if (!gb.having) return base;
    const hv = `{${gb.having.condition}(${gb.having.parameters?.join('|') ?? ''})}`;
    return base + hv;
  }

  private static serializeJoins(options: QueryOptions): string {
    return (options.joins ?? [])
      .map((j) => {
        // Serialize structured `onColumns` when present (the on string is now an optional
        // fallback) so distinct joins never collide on the cache key.
        const on =
          j.onColumns && j.onColumns.length > 0
            ? j.onColumns
                .map((c) => `${c.left.table}.${c.left.column}=${c.right.table}.${c.right.column}`)
                .join('&')
            : (j.on ?? '');
        return `${j.type}:${j.table}:${on};`;
      })
      .join('');
  }
}
