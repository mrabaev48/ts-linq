import type { DatabaseProvider } from '@ts-linq/core';
import type {
  CteDefinition,
  FallbackOperation,
  FallbackRequest,
  FilteredIncludeSpec,
  PerformanceOptions,
  QueryFallback,
  QuerySplittingBehavior,
  SqlParameter
} from '@ts-linq/types';
import { FallbackExhaustedError, QuerySplittingBehavior as QSB } from '@ts-linq/types';

import type { FallbackManager } from './FallbackManager';
import type { IncludePlanner } from './IncludePlanner';
import { logInternalError } from './InternalLogger';
import type { QueryBuilder } from './QueryBuilder';
import type { QueryModel } from './QueryModel';
import type { RowMaterializer } from './RowMaterializer';

/**
 * Handles all execution paths for a query: primary provider, fallback, and hedged racing.
 * Also owns the count execution path (with fallback/hedging).
 *
 * Queryable creates one executor per instance and re-creates it in clone() with an
 * independent FallbackManager (deep-copied throttle counters) per clone.
 */
export class QueryExecutor<T> {
  constructor(
    private readonly entityClass: new () => T,
    private readonly provider: DatabaseProvider,
    private readonly sqlBuilder: QueryBuilder,
    private readonly materializer: RowMaterializer<T>,
    private readonly includePlanner: IncludePlanner<T>,
    /** FallbackManager owns the fallback list and independent throttle state for this clone. */
    private readonly fallbackManager: FallbackManager<T>,
    private readonly performance: PerformanceOptions | undefined
  ) {}

  /**
   * Execute query, materialise rows into entities, and populate includes.
   * @param model              Pre-cloned and filter-applied QueryModel.
   * @param includes           Relationship names to eagerly load (Queryable._includes at call time).
   * @param cte                Optional CTE definition to attach to the model.
   * @param splittingBehavior  Query splitting strategy; defaults to SplitQuery.
   * @param filteredIncludes   Optional map of propertyName → FilteredIncludeSpec for filtered includes.
   */
  async executeAndMaterialize(
    model: QueryModel,
    includes: string[],
    cte: CteDefinition | undefined,
    splittingBehavior: QuerySplittingBehavior = QSB.SplitQuery,
    filteredIncludes?: Map<string, FilteredIncludeSpec>
  ): Promise<T[]> {
    if (cte) {
      (model as unknown as { cte?: CteDefinition }).cte = cte;
    }
    const sql = this.sqlBuilder.generateFromModel(this.entityClass, model);
    const hedge = this.performance?.fallbackPolicy?.hedged;
    if (
      hedge?.enabled &&
      this.fallbackManager.fallbacks.length > 0 &&
      this.isOpAllowedForFallback('select')
    ) {
      const winner = await this.racePrimaryWithFallback(
        async () => this.provider.executeQuery<Record<string, unknown>>(sql.query, sql.parameters),
        sql,
        hedge.delayMs ?? 15,
        this.getHedgedFallbacks()
      );
      if (winner.source === 'primary') {
        return this.handlePrimaryRows(
          model,
          winner.rows,
          includes,
          splittingBehavior,
          filteredIncludes
        );
      } else {
        return this.handleFallbackEntities(
          (winner.rows as unknown as T[]).slice(),
          winner.label || 'unknown',
          model,
          includes,
          splittingBehavior,
          filteredIncludes
        );
      }
    }
    try {
      const rows = await this.provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      return this.handlePrimaryRows(model, rows, includes, splittingBehavior, filteredIncludes);
    } catch (error) {
      if (!this.isOpAllowedForFallback('select')) throw error;
      if (!this.isDegradableError(error) || this.fallbackManager.fallbacks.length === 0)
        throw error;
      if (!this.tryEnterFallbackThrottle()) throw error;
      const entities = await this.tryFallbackSelectSequential(
        sql,
        model,
        includes,
        splittingBehavior,
        filteredIncludes
      );
      if (entities) return entities;
      throw error;
    }
  }

  /**
   * Execute COUNT query with optional hedging/fallback.
   * @param table  Table name from entity metadata.
   * @param model  Pre-cloned and filter-applied QueryModel.
   */
  async executeCount(table: string, model: QueryModel): Promise<number> {
    const { sql: query, params: parameters } = this.buildCountSqlAndParams(model, table);
    const hedge = this.performance?.fallbackPolicy?.hedged;
    if (
      hedge?.enabled &&
      this.fallbackManager.fallbacks.length > 0 &&
      this.isOpAllowedForFallback('count')
    ) {
      const hedged = await this.racePrimaryWithFallbackCount(query, parameters, model);
      if (hedged !== null) return hedged;
    }
    try {
      const results = await this.provider.executeQuery<{ count: number }>(query, parameters);
      return results[0]?.count ?? 0;
    } catch (error) {
      if (!this.isDegradableError(error) || this.fallbackManager.fallbacks.length === 0)
        throw error;
      if (!this.tryEnterFallbackThrottle()) throw error;
      const n = await this.tryFallbackCountSequential(model);
      if (n !== null) return n;
      throw error;
    }
  }

  private async handlePrimaryRows(
    model: QueryModel,
    rows: ReadonlyArray<Record<string, unknown>>,
    includes: string[],
    splittingBehavior: QuerySplittingBehavior = QSB.SplitQuery,
    filteredIncludes?: Map<string, FilteredIncludeSpec>
  ): Promise<T[]> {
    const entities = rows.map((row) => this.materializer.mapRowToEntity(row));
    await this.includePlanner.populateIncludes(
      entities,
      includes,
      model.limit,
      splittingBehavior,
      filteredIncludes
    );
    return entities;
  }

  private async handleFallbackEntities(
    entities: T[],
    label: string,
    model: QueryModel,
    includes: string[],
    splittingBehavior: QuerySplittingBehavior = QSB.SplitQuery,
    filteredIncludes?: Map<string, FilteredIncludeSpec>
  ): Promise<T[]> {
    if (this.performance?.fallbackPolicy?.allowIncludesOnFallback === 'attempt') {
      try {
        await this.includePlanner.populateIncludes(
          entities,
          includes,
          model.limit,
          splittingBehavior,
          filteredIncludes
        );
      } catch (e) {
        // Best-effort includes on stale fallback data — log but never break the fallback path.
        logInternalError('fallback.populateIncludes', e);
      }
    }
    this.provider.loggerRef?.fallback?.({
      provider: this.provider.providerLabel,
      fallback: label,
      attempted: true,
      succeeded: true,
      isStale: true,
      asOf: Date.now(),
      source: label
    });
    return entities;
  }

  private async tryFallbackSelectSequential(
    sql: { query: string; parameters: readonly SqlParameter[] },
    model: QueryModel,
    includes: string[],
    splittingBehavior: QuerySplittingBehavior = QSB.SplitQuery,
    filteredIncludes?: Map<string, FilteredIncludeSpec>
  ): Promise<T[] | null> {
    const req: FallbackRequest<T> = {
      operation: 'count',
      entityClass: this.entityClass,
      entity: this.entityClass,
      sql: sql.query,
      params: sql.parameters
    };
    for (const fb of this.fallbackManager.fallbacks) {
      try {
        this.provider.loggerRef?.fallback?.({
          provider: this.provider.providerLabel,
          fallback: fb.label,
          attempted: true
        });
        const data = await fb.fetch(req);
        if (data && data.length >= 0) {
          return this.handleFallbackEntities(
            data.slice(),
            fb.label,
            model,
            includes,
            splittingBehavior,
            filteredIncludes
          );
        }
      } catch (fbErr) {
        this.provider.loggerRef?.fallback?.({
          provider: this.provider.providerLabel,
          fallback: fb.label,
          attempted: true,
          succeeded: false,
          error: fbErr as Error
        });
        continue;
      }
    }
    return null;
  }

  private async racePrimaryWithFallback(
    primary: () => Promise<ReadonlyArray<Record<string, unknown>>>,
    sql: { query: string; parameters: readonly SqlParameter[] },
    delayMs: number,
    fallbacks: ReadonlyArray<QueryFallback<T>>
  ): Promise<
    | { source: 'primary'; rows: ReadonlyArray<Record<string, unknown>> }
    | { source: 'fallback'; rows: ReadonlyArray<unknown>; label: string }
  > {
    // Collect per-source failures so an exhausted fallback set surfaces an aggregate cause
    // instead of being silently indistinguishable from "no fallback configured".
    const fallbackErrors: unknown[] = [];
    const req: FallbackRequest<T> = {
      operation: 'count',
      entityClass: this.entityClass,
      entity: this.entityClass,
      sql: sql.query,
      params: sql.parameters
    };
    type FallbackOutcome =
      | { kind: 'data'; rows: ReadonlyArray<unknown>; label: string }
      | { kind: 'exhausted' }
      | { kind: 'none' };
    const startFallback = async (): Promise<FallbackOutcome> => {
      if (fallbacks.length === 0) return { kind: 'none' };
      for (const fb of fallbacks) {
        try {
          const data = await fb.fetch(req);
          if (data && data.length >= 0)
            return {
              kind: 'data',
              rows: data as unknown as ReadonlyArray<unknown>,
              label: fb.label
            };
        } catch (e) {
          logInternalError('hedged.select.fallback', e);
          fallbackErrors.push(e);
          continue;
        }
      }
      return { kind: 'exhausted' };
    };
    const failExhausted = (primaryErr: unknown): never => {
      // No fallback configured → surface the primary failure unchanged. All fallbacks failed →
      // aggregate, preserving the primary error as `cause` and the per-source errors in details.
      if (fallbacks.length === 0) throw primaryErr;
      throw new FallbackExhaustedError('All hedged fallback sources failed for select', {
        cause: primaryErr,
        details: { errors: fallbackErrors }
      });
    };
    const sleep = async (ms: number) => new Promise((r) => setTimeout(r, ms));
    // A single fallback attempt, shared by both the race and the primary-failure path, so the
    // fallback sources are never hit twice.
    const fallbackOutcomePromise: Promise<FallbackOutcome> = (async () => {
      await sleep(Math.max(0, delayMs));
      return startFallback();
    })();
    try {
      const primaryPromise = primary();
      const winner = await Promise.race([
        primaryPromise.then((rows) => ({ k: 'p', rows }) as const),
        // Fallback only competes in the race when it yields data; a non-data outcome must never
        // beat a live primary, so it adopts a never-settling promise and lets primary decide.
        fallbackOutcomePromise.then(async (o) =>
          o.kind === 'data'
            ? ({ k: 'f', rows: o.rows, label: o.label } as const)
            : new Promise<{ k: 'f'; rows: ReadonlyArray<unknown>; label: string }>(() => {})
        )
      ]);
      if (winner.k === 'p') {
        return { source: 'primary', rows: winner.rows };
      } else {
        try {
          this.provider.loggerRef?.hedgedWin?.({
            provider: this.provider.providerLabel,
            operation: 'select',
            fallback: winner.label || 'unknown'
          });
        } catch (e) {
          logInternalError('hedged.select.hedgedWin', e);
        }
        this.provider.loggerRef?.fallback?.({
          provider: this.provider.providerLabel,
          fallback: winner.label || 'unknown',
          attempted: true,
          succeeded: true
        });
        return { source: 'fallback', rows: winner.rows, label: winner.label || 'unknown' };
      }
    } catch (primaryErr) {
      // Primary rejected. Await the single fallback attempt; an empty result is NEVER returned as
      // success when every source failed — exhaustion surfaces as a typed aggregate.
      const outcome = await fallbackOutcomePromise;
      if (outcome.kind === 'data')
        return { source: 'fallback', rows: outcome.rows, label: outcome.label };
      return failExhausted(primaryErr);
    }
  }

  private getHedgedFallbacks(): ReadonlyArray<QueryFallback<T>> {
    const src = this.performance?.fallbackPolicy?.hedged?.sources;
    if (!src || src.length === 0) return this.fallbackManager.fallbacks;
    const wanted = new Set(src);
    return this.fallbackManager.fallbacks.filter((fb) => wanted.has(fb.label));
  }

  private tryEnterFallbackThrottle(): boolean {
    const throttle = this.performance?.fallbackPolicy?.throttle;
    if (!throttle) return true;
    const now = Date.now();
    const minInterval = Math.max(0, throttle.minIntervalMs ?? 0);
    const jitter = Math.max(0, Math.min(1, throttle.jitterRatio ?? 0));
    const effectiveInterval =
      minInterval > 0 && jitter > 0
        ? Math.floor(minInterval * (1 + Math.random() * jitter))
        : minInterval;
    if (minInterval > 0) {
      const since = now - this.fallbackManager.throttle.lastAttemptAt;
      if (since < effectiveInterval) {
        this.provider.loggerRef?.fallback?.({
          provider: this.provider.providerLabel,
          fallback: 'n/a',
          attempted: false,
          throttled: true
        });
        return false;
      }
    }
    const maxPerMinute = Math.max(0, throttle.maxPerMinute ?? 0);
    if (maxPerMinute > 0) {
      const windowMs = 60_000;
      if (now - this.fallbackManager.throttle.windowStart >= windowMs) {
        this.fallbackManager.throttle.windowStart = now;
        this.fallbackManager.throttle.usedInWindow = 0;
      }
      if (this.fallbackManager.throttle.usedInWindow >= maxPerMinute) return false;
      this.fallbackManager.throttle.usedInWindow += 1;
    }
    this.fallbackManager.throttle.lastAttemptAt = now;
    return true;
  }

  private isDegradableError(error: unknown): boolean {
    if (!error) return false;
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return (
      message.includes('circuit') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('too many connections') ||
      message.includes('econnreset')
    );
  }

  private isOpAllowedForFallback(op: FallbackOperation): boolean {
    const allow = this.performance?.fallbackPolicy?.allowOps;
    return !allow || allow.includes(op);
  }

  private buildCountSqlAndParams(
    queryModel: QueryModel,
    _table: string
  ): { sql: string; params: SqlParameter[] } {
    // Route through the dialect via sqlBuilder so placeholders ($N, @pN, ?) are emitted correctly.
    const countModel = queryModel.clone();
    (countModel as unknown as { select?: string[] }).select = ['COUNT(*) as count'];
    countModel.orderBy = undefined;
    countModel.limit = undefined;
    countModel.offset = undefined;
    (countModel as unknown as { distinct?: boolean }).distinct = false;
    const built = this.sqlBuilder.generateFromModel(this.entityClass, countModel);
    return { sql: built.query, params: built.parameters as SqlParameter[] };
  }

  private async tryFallbackCountSequential(queryModel: QueryModel): Promise<number | null> {
    const normal = this.sqlBuilder.generateFromModel(this.entityClass, queryModel);
    const req: FallbackRequest<T> = {
      operation: 'count',
      entityClass: this.entityClass,
      entity: this.entityClass,
      sql: normal.query,
      params: normal.parameters
    };
    for (const fb of this.fallbackManager.fallbacks) {
      try {
        this.provider.loggerRef?.fallback?.({
          provider: this.provider.providerLabel,
          fallback: fb.label,
          attempted: true
        });
        if (typeof fb.fetchCount === 'function') {
          const n = await fb.fetchCount(req);
          if (typeof n === 'number') return n;
        }
        const data = await fb.fetch(req);
        if (data && data.length >= 0) return (data as unknown as unknown[]).length;
      } catch (fbErr) {
        this.provider.loggerRef?.fallback?.({
          provider: this.provider.providerLabel,
          fallback: fb.label,
          attempted: true,
          succeeded: false,
          error: fbErr as Error
        });
        continue;
      }
    }
    return null;
  }

  private async racePrimaryWithFallbackCount(
    countSql: string,
    params: readonly SqlParameter[],
    queryModel: QueryModel
  ): Promise<number | null> {
    const hedge = this.performance?.fallbackPolicy?.hedged;
    if (!hedge?.enabled) return null;
    const normal = this.sqlBuilder.generateFromModel(this.entityClass, queryModel);
    const req: FallbackRequest<T> = {
      operation: 'count',
      entityClass: this.entityClass,
      entity: this.entityClass,
      sql: normal.query,
      params: normal.parameters
    };
    const sleep = async (ms: number) => new Promise((r) => setTimeout(r, ms));
    const fallbacks = this.getHedgedFallbacks();
    const fallbackCountPromise = (async () => {
      await sleep(Math.max(0, hedge.delayMs ?? 15));
      for (const fb of fallbacks) {
        try {
          if (typeof fb.fetchCount === 'function') {
            const n = await fb.fetchCount(req);
            if (typeof n === 'number') return n;
          }
          const data = await fb.fetch(req);
          if (data && data.length >= 0) return (data as unknown as unknown[]).length;
        } catch (e) {
          logInternalError('hedged.startFallback.fetch', e);
          continue;
        }
      }
      return -1;
    })();
    try {
      const primaryPromise = this.provider
        .executeQuery<{ count: number }>(countSql, params)
        .then((rows: Array<{ count: number }>) => rows[0]?.count ?? 0);
      const winner = await Promise.race([
        primaryPromise.then((n: number) => ({ k: 'p', n }) as const),
        fallbackCountPromise.then((n: number) => ({ k: 'f', n }) as const)
      ]);
      if (winner.k === 'p') return winner.n;
      if (typeof winner.n === 'number' && winner.n >= 0) {
        try {
          this.provider.loggerRef?.hedgedWin?.({
            provider: this.provider.providerLabel,
            operation: 'count',
            fallback: 'unknown'
          });
          this.provider.loggerRef?.fallback?.({
            provider: this.provider.providerLabel,
            fallback: 'unknown',
            attempted: true,
            succeeded: true
          });
        } catch (e) {
          logInternalError('hedged.select.hedgedWin', e);
        }
        return winner.n;
      }
      return await primaryPromise;
    } catch (e) {
      // Degradation, but fail-loud upstream: returning null falls through to executeCount's
      // own primary+sequential path, which rethrows the real error. Log for observability.
      logInternalError('hedged.count.race', e);
      return null;
    }
  }
}
