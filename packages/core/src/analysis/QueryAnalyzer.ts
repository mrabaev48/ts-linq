import type { OrmMiddleware, QueryAnalysisInfo, SqlLogger, SqlParameter } from '@ts-linq/types';

import type { QueryPerformanceAnalysisOptions } from '../types';
import { logInternalError } from '../utils/InternalLogger';

const SELECT_PREFIX = /^\s*SELECT\b/i;

/** Volatile per-query context supplied by the host provider at analysis time. */
export interface QueryAnalysisContext {
  /** Whether the query ran inside an explicit transaction (EXPLAIN is skipped if so). */
  readonly inTransaction: boolean;
  /** Logical provider name for the emitted {@link QueryAnalysisInfo} payload. */
  readonly providerName: string;
  /** Active logger (may have been replaced via `attachLogger`). */
  readonly logger?: SqlLogger;
  /** Active middleware chain. */
  readonly middlewares?: OrmMiddleware[];
  /** Provider hook obtaining an EXPLAIN plan for the SQL, if supported. */
  getExplainPlan(sql: string, params: readonly SqlParameter[]): Promise<unknown | undefined>;
}

/** Outcome of a single executed query handed to the analyzer. */
export interface QueryAnalysisInput {
  readonly sql: string;
  readonly params: readonly SqlParameter[];
  readonly durationMs: number;
  readonly error?: Error;
}

/**
 * Query-performance analysis policy (Strategy + Policy).
 *
 * Extracted verbatim from `DatabaseProvider.maybeAnalyzeQuery`: owns the
 * `enabled`/`onlySelect` gating, probabilistic sampling, per-minute rate
 * limiting, the EXPLAIN-plan capture with a race-based timeout, plan size
 * clamping, and fan-out to the logger + middlewares.
 *
 * `now`, `random`, and `sleep` are injected so sampling / rate-limit windows /
 * EXPLAIN timeouts can be exercised deterministically in unit tests.
 */
export class QueryAnalyzer {
  private config?: QueryPerformanceAnalysisOptions;
  private windowStartMs?: number;
  private inWindow = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
    private readonly sleep: (ms: number) => Promise<undefined> = async (ms) =>
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))
  ) {}

  /** Merge new analysis options into the current configuration. */
  public configure(options?: QueryPerformanceAnalysisOptions): void {
    this.config = { ...this.config, ...options };
  }

  /** Emit an analysis event when thresholds/sampling/rate-limit allow. */
  public async analyze(input: QueryAnalysisInput, ctx: QueryAnalysisContext): Promise<void> {
    const cfg = this.config;
    if (!cfg?.enabled) return;

    // only SELECT if configured
    const onlySelect = cfg.onlySelect ?? true;
    if (onlySelect && !SELECT_PREFIX.test(input.sql)) return;

    // sampling
    const rate = Math.max(0, Math.min(1, cfg.sampleRate ?? 1));
    if (rate < 1 && this.random() > rate) return;

    // rate limiting per minute
    const now = this.now();
    const windowStart = this.windowStartMs ?? now;
    const perMinute = Math.max(1, cfg.rateLimitPerMinute ?? 120);
    if (now - windowStart >= 60_000) {
      this.windowStartMs = now;
      this.inWindow = 0;
    }
    if (this.inWindow >= perMinute) return;
    this.inWindow += 1;

    const explainT = cfg.explainThresholdMs ?? 500;
    const slowT = cfg.slowQueryThresholdMs ?? 1000;
    const needExplain = input.durationMs >= explainT && !input.error && !ctx.inTransaction;
    let plan: unknown | undefined;
    if (needExplain) {
      try {
        const timeoutMs = Math.max(1, cfg.explainTimeoutMs ?? 1000);
        plan = await Promise.race([
          ctx.getExplainPlan(input.sql, input.params),
          this.sleep(timeoutMs)
        ]);
      } catch (e) {
        logInternalError('QueryAnalyzer.analyze.explain', e);
      }
    }

    // size limit on plan (stringifiable only)
    const maxChars = Math.max(1024, cfg.maxExplainChars ?? 65536);
    const safePlan = ((): unknown => {
      if (plan === undefined || plan === null) return plan;
      try {
        const s = typeof plan === 'string' ? plan : JSON.stringify(plan);
        if (s.length <= maxChars) return plan;
        return s.slice(0, maxChars);
      } catch {
        return plan;
      }
    })();

    const payload: QueryAnalysisInfo = {
      sql: input.sql,
      params: input.params,
      durationMs: input.durationMs,
      provider: ctx.providerName,
      slow: input.durationMs >= slowT,
      explainPlan: safePlan,
      recommendations: cfg.recommendations ? this.deriveRecommendations(plan) : undefined
    };

    try {
      // Prefer dedicated hook if logger implements it; also notify middlewares.
      ctx.logger?.analysis?.(payload);
      if (ctx.middlewares && ctx.middlewares.length > 0) {
        for (const mw of ctx.middlewares) {
          try {
            mw.analysis?.(payload);
          } catch (e) {
            logInternalError('QueryAnalyzer.analyze.middleware', e);
          }
        }
      }
    } catch (e) {
      logInternalError('QueryAnalyzer.analyze.logger', e);
    }
  }

  /** Heuristic recommendations from provider-agnostic plans. */
  private deriveRecommendations(_plan: unknown | undefined): ReadonlyArray<string> | undefined {
    // Minimal placeholder: concrete providers can override getExplainPlan with richer structures
    return undefined;
  }
}
