import type { DatabaseProvider } from '@ts-linq/core';
import type {
  CteDefinition,
  FallbackOperation,
  FallbackRequest,
  PerformanceOptions,
  QueryFallback,
  SqlParameter
} from '@ts-linq/types';

import { FallbackManager } from './FallbackManager';
import { logInternalError } from './InternalLogger';
import { IncludePlanner } from './IncludePlanner';
import { QueryBuilder } from './QueryBuilder';
import { QueryModel } from './QueryModel';
import { RowMaterializer } from './RowMaterializer';

/**
 * Handles all execution paths for a query: primary provider, fallback, and hedged racing.
 * Also owns the count execution path (with fallback/hedging).
 *
 * Queryable creates one executor per instance and re-creates it in clone() so the
 * shared throttle reference remains correct across all clones in a chain.
 */
export class QueryExecutor<T> {
  constructor(
    private readonly entityClass: new () => T,
    private readonly provider: DatabaseProvider,
    private readonly sqlBuilder: QueryBuilder,
    private readonly materializer: RowMaterializer<T>,
    private readonly includePlanner: IncludePlanner<T>,
    /** FallbackManager owns the fallback list and shared throttle state for the chain. */
    private readonly fallbackManager: FallbackManager<T>,
    private readonly performance: PerformanceOptions | undefined
  ) {}

  /**
   * Execute query, materialise rows into entities, and populate includes.
   * @param model   Pre-cloned and filter-applied QueryModel.
   * @param includes Relationship names to eagerly load (Queryable._includes at call time).
   * @param cte     Optional CTE definition to attach to the model.
   */
  async executeAndMaterialize(
    model: QueryModel,
    includes: string[],
    cte: CteDefinition | undefined
  ): Promise<T[]> {
    if (cte) {
      (model as unknown as { cte?: CteDefinition }).cte = cte;
    }
    const sql = this.sqlBuilder.generateFromModel(this.entityClass, model);
    const hedge = this.performance?.fallbackPolicy?.hedged;
    if (hedge?.enabled && this.fallbackManager.fallbacks.length > 0 && this.isOpAllowedForFallback('select')) {
      const winner = await this.racePrimaryWithFallback(
        () => this.provider.executeQuery<Record<string, unknown>>(sql.query, sql.parameters),
        sql,
        hedge.delayMs ?? 15,
        this.getHedgedFallbacks()
      );
      if (winner.source === 'primary') {
        return this.handlePrimaryRows(model, winner.rows, includes);
      } else {
        return this.handleFallbackEntities(
          (winner.rows as unknown as T[]).slice(),
          winner.label || 'unknown',
          model,
          includes
        );
      }
    }
    try {
      const rows = await this.provider.executeQuery<Record<string, unknown>>(
        sql.query,
        sql.parameters
      );
      return this.handlePrimaryRows(model, rows, includes);
    } catch (error) {
      if (!this.isOpAllowedForFallback('select')) throw error;
      if (!this.isDegradableError(error) || this.fallbackManager.fallbacks.length === 0) throw error;
      if (!this.tryEnterFallbackThrottle()) throw error;
      const entities = await this.tryFallbackSelectSequential(sql, model, includes);
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
    if (hedge?.enabled && this.fallbackManager.fallbacks.length > 0 && this.isOpAllowedForFallback('count')) {
      const hedged = await this.racePrimaryWithFallbackCount(query, parameters, model);
      if (hedged !== null) return hedged;
    }
    try {
      const results = await this.provider.executeQuery<{ count: number }>(query, parameters);
      return results[0]?.count ?? 0;
    } catch (error) {
      if (!this.isDegradableError(error) || this.fallbackManager.fallbacks.length === 0) throw error;
      if (!this.tryEnterFallbackThrottle()) throw error;
      const n = await this.tryFallbackCountSequential(model);
      if (n !== null) return n;
      throw error;
    }
  }

  private async handlePrimaryRows(
    model: QueryModel,
    rows: ReadonlyArray<Record<string, unknown>>,
    includes: string[]
  ): Promise<T[]> {
    const entities = rows.map((row) => this.materializer.mapRowToEntity(row));
    await this.includePlanner.populateIncludes(entities, includes, model.limit);
    return entities;
  }

  private async handleFallbackEntities(
    entities: T[],
    label: string,
    model: QueryModel,
    includes: string[]
  ): Promise<T[]> {
    if (this.performance?.fallbackPolicy?.allowIncludesOnFallback === 'attempt') {
      try {
        await this.includePlanner.populateIncludes(entities, includes, model.limit);
      } catch {}
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
    includes: string[]
  ): Promise<T[] | null> {
    const req: FallbackRequest<T> = {
      operation: 'count' as FallbackOperation,
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
            (data as unknown as T[]).slice(),
            fb.label,
            model,
            includes
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
    let fallbackStarted = false;
    const req: FallbackRequest<T> = {
      operation: 'count' as FallbackOperation,
      entityClass: this.entityClass,
      entity: this.entityClass,
      sql: sql.query,
      params: sql.parameters
    };
    const startFallback = async (): Promise<{ rows: ReadonlyArray<unknown>; label: string }> => {
      fallbackStarted = true;
      for (const fb of fallbacks) {
        try {
          const data = await fb.fetch(req);
          if (data && data.length >= 0)
            return { rows: data as unknown as ReadonlyArray<unknown>, label: fb.label };
        } catch {
          continue;
        }
      }
      return { rows: [] as unknown as ReadonlyArray<unknown>, label: 'none' };
    };
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const fallbackPromise = (async () => {
      await sleep(Math.max(0, delayMs));
      return startFallback();
    })();
    try {
      const primaryPromise = primary();
      const winner = await Promise.race([
        primaryPromise.then((rows) => ({ k: 'p', rows }) as const),
        fallbackPromise.then((v) => ({ k: 'f', rows: v.rows, label: v.label }) as const)
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
    } catch {
      if (!fallbackStarted) {
        const v = await startFallback();
        return { source: 'fallback', rows: v.rows, label: v.label };
      }
      throw new Error('hedged failed');
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
    table: string
  ): { sql: string; params: SqlParameter[] } {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const params: SqlParameter[] = [];
    if (queryModel.where && queryModel.where.length > 0) {
      let first = true;
      sql += ' WHERE ';
      for (const wc of queryModel.where) {
        if (!first) sql += ' AND ';
        first = false;
        sql += wc.condition;
        for (let i = 0; i < wc.parameters.length; i++) params.push(wc.parameters[i]);
      }
    }
    return { sql, params };
  }

  private async tryFallbackCountSequential(queryModel: QueryModel): Promise<number | null> {
    const normal = this.sqlBuilder.generateFromModel(this.entityClass, queryModel);
    const req: FallbackRequest<T> = {
      operation: 'count' as FallbackOperation,
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
      operation: 'count' as FallbackOperation,
      entityClass: this.entityClass,
      entity: this.entityClass,
      sql: normal.query,
      params: normal.parameters
    };
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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
    } catch {
      return null;
    }
  }
}
