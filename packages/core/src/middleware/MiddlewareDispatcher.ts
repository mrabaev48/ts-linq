import type { EntityMetadata, OrmMiddleware, SqlParameter } from '@ts-linq/types';

import { logInternalError } from '../utils/InternalLogger';

/**
 * Observer fan-out for the {@link OrmMiddleware} chain.
 *
 * Mirrors {@link InterceptorDispatcher} for middlewares so `DatabaseProvider`
 * keeps only thin `beforeExecute`/`afterExecute`/`notifyEntityMaterialized`
 * hooks. The middleware list is read lazily so a provider can populate it after
 * construction.
 *
 * Failure-isolation policy matches the original provider: `beforeExecute`
 * propagates (a middleware may veto/raise), while `afterExecute` and
 * `entityMaterialized` isolate each middleware via {@link logInternalError}.
 */
export class MiddlewareDispatcher {
  constructor(private readonly getMiddlewares: () => OrmMiddleware[] | undefined) {}

  private get list(): OrmMiddleware[] {
    return this.getMiddlewares() ?? [];
  }

  /** Pre-execution middleware notification (errors propagate). */
  public async beforeExecute(
    sql: string,
    params: readonly SqlParameter[],
    traceId?: string
  ): Promise<void> {
    const middlewares = this.list;
    if (middlewares.length === 0) return;
    const info = { sql, params, traceId };
    for (const mw of middlewares) {
      await mw.beforeExecute?.(info);
    }
  }

  /** Post-execution middleware notification (each middleware isolated). */
  public async afterExecute(
    sql: string,
    params: readonly SqlParameter[],
    result: unknown,
    durationMs: number,
    traceId?: string
  ): Promise<void> {
    const middlewares = this.list;
    if (middlewares.length === 0) return;
    const rows = Array.isArray(result)
      ? (result as unknown[]).length
      : typeof result === 'number'
        ? result
        : undefined;
    const info = { sql, params, durationMs, traceId, rows } as const;
    for (const mw of middlewares) {
      try {
        await mw.afterExecute?.(info);
      } catch (e) {
        logInternalError('MiddlewareDispatcher.afterExecute', e);
      }
    }
  }

  /** Materialization middleware notification (each middleware isolated). */
  public async entityMaterialized(entity: object, metadata?: EntityMetadata): Promise<void> {
    const middlewares = this.list;
    if (middlewares.length === 0) return;
    const info: { entity: object; metadata?: EntityMetadata } = { entity, metadata };
    for (const mw of middlewares) {
      try {
        // eslint-disable-next-line @typescript-eslint/await-thenable
        await mw.entityMaterialized?.(info);
      } catch (e) {
        logInternalError('MiddlewareDispatcher.entityMaterialized', e);
      }
    }
  }
}
