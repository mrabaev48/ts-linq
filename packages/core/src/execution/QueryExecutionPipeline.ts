import type { SqlLogger, SqlParameter } from '@ts-linq/types';

import type { ResilienceContext, ResilienceManager } from '../Resilience/ResilienceManager';

/**
 * Per-call orchestration request handed to {@link QueryExecutionPipeline.execute}.
 *
 * The host provider supplies the volatile state (sql/params/traceId/logger…) and
 * the lifecycle hooks; the pipeline owns the fixed orchestration sequence. The
 * hook callbacks intentionally close over the provider's existing
 * `beforeExecute`/`afterExecute`/analyzer so those signatures stay unchanged for
 * subclasses that invoke them directly.
 */
export interface QueryExecutionRequest {
  readonly sql: string;
  readonly params: readonly SqlParameter[];
  readonly traceId?: string;
  readonly inTransaction: boolean;
  readonly providerName: string;
  readonly logger?: SqlLogger;
  /** Called once per attempt with the start timestamp (e.g. to seed duration tracking). */
  onStart(startedAt: number): void;
  /** Pre-execution hook (middleware + command-interceptor "executing"). */
  beforeExecute(): Promise<void>;
  /** Post-execution hook (middleware + command-interceptor "executed"). */
  afterExecute(result: unknown): Promise<void>;
  /** Query-performance analysis for the completed (or failed) attempt. */
  analyze(durationMs: number, error?: Error): Promise<void>;
}

/**
 * Template Method for query execution.
 *
 * Wraps the supplied `fn` in the resilience manager (circuit breaker + retries)
 * and runs the fixed sequence around each attempt: start timing → `queryStart`
 * log → `beforeExecute` → `fn` → `queryEnd` log → analysis → `afterExecute`,
 * with the error branch logging + analysing the failure before rethrowing.
 *
 * `now` is injectable for deterministic duration assertions in tests.
 */
export class QueryExecutionPipeline {
  constructor(
    private readonly resilience: ResilienceManager,
    private readonly now: () => number = Date.now
  ) {}

  public async execute<T>(fn: () => Promise<T>, req: QueryExecutionRequest): Promise<T> {
    const context: ResilienceContext = {
      sql: req.sql,
      params: req.params,
      traceId: req.traceId,
      inTransaction: req.inTransaction
    };

    return this.resilience.execute(async () => {
      const startedAt = this.now();
      req.onStart(startedAt);

      req.logger?.queryStart?.({
        sql: req.sql,
        params: req.params,
        traceId: req.traceId,
        provider: req.providerName
      });

      await req.beforeExecute();

      try {
        const result = await fn();
        const durationMs = this.now() - startedAt;

        req.logger?.queryEnd?.({
          sql: req.sql,
          params: req.params,
          durationMs,
          traceId: req.traceId,
          rows: Array.isArray(result)
            ? (result as unknown[]).length
            : typeof result === 'number'
              ? result
              : undefined,
          provider: req.providerName
        });

        await req.analyze(durationMs);
        await req.afterExecute(result);

        return result;
      } catch (error) {
        const durationMs = this.now() - startedAt;
        req.logger?.queryEnd?.({
          sql: req.sql,
          params: req.params,
          durationMs,
          traceId: req.traceId,
          error: error as Error,
          provider: req.providerName
        });
        await req.analyze(durationMs, error as Error);
        throw error;
      }
    }, context);
  }
}
