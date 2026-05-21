import type { SqlCache, SqlCacheEntry, TemplateSqlCache } from '@ts-linq/types';

/**
 * Normalises a QueryBuilder cache key to a structure-only form by stripping
 * bound parameter values. This allows the same SQL template to match regardless
 * of what runtime values were passed.
 *
 * Handles:
 *   foo = ?(42)       → foo = ?()        (whereCompiled / transformer output)
 *   IN (?, ?, ?)(1|2) → IN (?, ?, ?)()  (whereIn runtime path)
 */
function normaliseKey(key: string): string {
  return key
    .replace(/\?\(([^)]*)\)/g, '?()') // strip ?(val) after ? placeholders
    .replace(/\)\(([^()]*)\)/g, ')()'); // strip )(val) groups (whereIn params)
}

/**
 * A plan-level SQL cache used by CapturedQueryPlan.
 * Stores only the SQL template string (no parameter values).
 * On getTemplate() hit, the caller re-extracts current parameters from the
 * QueryOptions so stale parameter values are never returned.
 *
 * Exported for unit testing and advanced observability.
 * Use via CapturedQueryPlan.planSqlCache for typical usage.
 */
export class PlanSqlCache implements TemplateSqlCache {
  private readonly _store = new Map<string, string>();
  private _hits = 0;
  private _misses = 0;

  getTemplate(key: string): { query: string } | undefined {
    const k = normaliseKey(key);
    const q = this._store.get(k);
    if (q !== undefined) {
      this._hits++;
      return { query: q };
    }
    this._misses++;
    return undefined;
  }

  get(_key: string): SqlCacheEntry | undefined {
    return undefined;
  }

  set(key: string, value: SqlCacheEntry): void {
    const k = normaliseKey(key);
    if (!this._store.has(k)) {
      this._store.set(k, value.query);
    }
  }

  clear(): void {
    this._store.clear();
    this._hits = 0;
    this._misses = 0;
  }

  size(): number {
    return this._store.size;
  }

  invalidateBy(matcher: (key: string) => boolean): number {
    let removed = 0;
    for (const k of Array.from(this._store.keys())) {
      if (matcher(k)) {
        this._store.delete(k);
        removed++;
      }
    }
    return removed;
  }

  get cacheHits(): number {
    return this._hits;
  }

  get cacheMisses(): number {
    return this._misses;
  }
}

/**
 * A compiled query plan created by EF.compileQuery / EF.compileAsyncQuery.
 *
 * Wraps a factory lambda and provides a plan-level SQL cache (PlanSqlCache) that
 * uses structure-only keys. Inject planSqlCache into DbContext's performance options
 * to enable plan-level SQL caching:
 *
 * ```ts
 * const getById = EF.compileQuery(
 *   (ctx: AppContext, id: number) => ctx.users.whereIn('id', [id]).firstOrDefault()
 * );
 *
 * const ctx = new AppContext({
 *   provider,
 *   performance: { sqlCache: getById.plan.planSqlCache }
 * });
 *
 * const user = await getById(ctx, 1);
 * const user2 = await getById(ctx, 2); // SQL template reused — cacheHits === 1
 * ```
 */
export class CapturedQueryPlan<TCtx, TParams extends unknown[], TResult> {
  private readonly _cache = new PlanSqlCache();
  private _invocations = 0;

  constructor(private readonly _factory: (ctx: TCtx, ...params: TParams) => Promise<TResult>) {}

  /**
   * Execute the compiled plan with the given context and parameters.
   * The first call populates the plan's SQL template cache; subsequent calls reuse it.
   */
  async execute(ctx: TCtx, ...params: TParams): Promise<TResult> {
    this._invocations++;
    return this._factory(ctx, ...params);
  }

  /**
   * The plan-level SQL cache. Inject into DbContext's performance options to enable
   * structure-based SQL caching across different parameter values.
   */
  get planSqlCache(): SqlCache {
    return this._cache as SqlCache;
  }

  /** Number of times the SQL template was reused (not regenerated). */
  get cacheHits(): number {
    return this._cache.cacheHits;
  }

  /** Number of times SQL was generated from scratch (template not yet cached). */
  get cacheMisses(): number {
    return this._cache.cacheMisses;
  }

  /** Total number of times this plan has been invoked. */
  get invocationCount(): number {
    return this._invocations;
  }

  /** Whether this plan's SQL template has been cached (first execution completed). */
  get isWarm(): boolean {
    return this._cache.cacheHits > 0;
  }
}
