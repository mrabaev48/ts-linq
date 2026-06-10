import type { SqlParameter } from '@ts-linq/types';

import { logInternalError } from '../utils/InternalLogger';
import type { IDbCommandInterceptor } from './IDbCommandInterceptor';
import type { IDbConnectionInterceptor } from './IDbConnectionInterceptor';
import type { IDbTransactionInterceptor } from './IDbTransactionInterceptor';
import type { IMaterializationInterceptor } from './IMaterializationInterceptor';
import type { CommandEventData, ConnectionEventData, DbCommand, DbReader } from './types';

const SELECT_PREFIX = /^\s*SELECT\b/i;

/**
 * Mediator (Observer fan-out) for EF-style interceptors.
 *
 * Owns the four interceptor partitions and centralises lifecycle notification so
 * {@link DatabaseProvider} no longer carries the arrays plus ~14 near-identical
 * `notify*` helpers. Each collaborator can be unit-tested in isolation.
 *
 * Failure-isolation policy mirrors the original provider semantics:
 * - **"…executing" / "…ing" pre-events** (`commandExecuting`) propagate so an
 *   interceptor can abort the command;
 * - **post-events** (connection/transaction notifications, `commandExecuted`,
 *   `entityMaterialized`) isolate each interceptor via {@link logInternalError}
 *   so one faulty interceptor neither stops the others nor breaks the query.
 */
export class InterceptorDispatcher {
  private command: IDbCommandInterceptor[] = [];
  private connection: IDbConnectionInterceptor[] = [];
  private transaction: IDbTransactionInterceptor[] = [];
  private materialization: IMaterializationInterceptor[] = [];

  /** Register interceptors partitioned by interface type. */
  public configure(opts: {
    command: IDbCommandInterceptor[];
    connection: IDbConnectionInterceptor[];
    transaction: IDbTransactionInterceptor[];
    materialization: IMaterializationInterceptor[];
  }): void {
    this.command = opts.command;
    this.connection = opts.connection;
    this.transaction = opts.transaction;
    this.materialization = opts.materialization;
  }

  /** Whether any command interceptor is registered (cheap fast-path guard). */
  public get hasCommandInterceptors(): boolean {
    return this.command.length > 0;
  }

  // ── Connection lifecycle ────────────────────────────────────────────────

  public async connectionOpening(): Promise<void> {
    await this.notifyConnection('connectionOpening', async (ic, ev) => ic.connectionOpening?.(ev));
  }

  public async connectionOpened(): Promise<void> {
    await this.notifyConnection('connectionOpened', async (ic, ev) => ic.connectionOpened?.(ev));
  }

  public async connectionClosing(): Promise<void> {
    await this.notifyConnection('connectionClosing', async (ic, ev) => ic.connectionClosing?.(ev));
  }

  public async connectionClosed(): Promise<void> {
    await this.notifyConnection('connectionClosed', async (ic, ev) => ic.connectionClosed?.(ev));
  }

  private async notifyConnection(
    method: string,
    invoke: (ic: IDbConnectionInterceptor, ev: ConnectionEventData) => void | Promise<void>
  ): Promise<void> {
    if (this.connection.length === 0) return;
    const ev: ConnectionEventData = {};
    for (const ic of this.connection) {
      try {
        await invoke(ic, ev);
      } catch (e) {
        logInternalError(`InterceptorDispatcher.${method}`, e);
      }
    }
  }

  // ── Transaction lifecycle ───────────────────────────────────────────────

  public async transactionStarting(traceId?: string): Promise<void> {
    await this.notifyTransaction('transactionStarting', traceId, async (ic, ev) =>
      ic.transactionStarting?.(ev)
    );
  }

  public async transactionStarted(traceId?: string): Promise<void> {
    await this.notifyTransaction('transactionStarted', traceId, async (ic, ev) =>
      ic.transactionStarted?.(ev)
    );
  }

  public async transactionCommitting(traceId?: string): Promise<void> {
    await this.notifyTransaction('transactionCommitting', traceId, async (ic, ev) =>
      ic.transactionCommitting?.(ev)
    );
  }

  public async transactionCommitted(traceId?: string): Promise<void> {
    await this.notifyTransaction('transactionCommitted', traceId, async (ic, ev) =>
      ic.transactionCommitted?.(ev)
    );
  }

  public async transactionRollingBack(traceId?: string): Promise<void> {
    await this.notifyTransaction('transactionRollingBack', traceId, async (ic, ev) =>
      ic.transactionRollingBack?.(ev)
    );
  }

  public async transactionRolledBack(traceId?: string): Promise<void> {
    await this.notifyTransaction('transactionRolledBack', traceId, async (ic, ev) =>
      ic.transactionRolledBack?.(ev)
    );
  }

  private async notifyTransaction(
    method: string,
    traceId: string | undefined,
    invoke: (ic: IDbTransactionInterceptor, ev: { traceId?: string }) => void | Promise<void>
  ): Promise<void> {
    if (this.transaction.length === 0) return;
    const ev = { traceId };
    for (const ic of this.transaction) {
      try {
        await invoke(ic, ev);
      } catch (e) {
        logInternalError(`InterceptorDispatcher.${method}`, e);
      }
    }
  }

  // ── Command lifecycle ───────────────────────────────────────────────────

  /**
   * Pre-execution command fan-out. Errors propagate so an interceptor can abort
   * the command (parity with the previous inline `beforeExecute` behaviour).
   */
  public async commandExecuting(
    sql: string,
    params: readonly SqlParameter[],
    traceId?: string
  ): Promise<void> {
    if (this.command.length === 0) return;
    const isReader = SELECT_PREFIX.test(sql);
    const cmd: DbCommand = { sql, params, traceId };
    const ev: CommandEventData = { commandText: sql, isReader };
    for (const ic of this.command) {
      if (isReader) {
        await ic.readerExecuting?.(cmd, ev);
      } else {
        await ic.nonQueryExecuting?.(cmd, ev);
      }
    }
  }

  /**
   * Post-execution command fan-out. Each interceptor is isolated via
   * {@link logInternalError}.
   */
  public async commandExecuted(
    sql: string,
    params: readonly SqlParameter[],
    traceId: string | undefined,
    durationMs: number,
    result: unknown
  ): Promise<void> {
    if (this.command.length === 0) return;
    const isReader = SELECT_PREFIX.test(sql);
    const cmd: DbCommand = { sql, params, traceId };
    const ev: CommandEventData = { commandText: sql, durationMs, isReader };
    for (const ic of this.command) {
      try {
        if (isReader) {
          const dbReader: DbReader = { rows: Array.isArray(result) ? (result as unknown[]) : [] };
          await ic.readerExecuted?.(cmd, ev, dbReader);
        } else {
          const affected = typeof result === 'number' ? result : 0;
          await ic.nonQueryExecuted?.(cmd, ev, affected);
        }
      } catch (e) {
        logInternalError('InterceptorDispatcher.commandExecuted', e);
      }
    }
  }

  // ── Materialization ─────────────────────────────────────────────────────

  /**
   * Run materialization interceptors over a freshly-materialized entity,
   * returning the (potentially replaced) instance. Each interceptor is isolated.
   */
  public async entityMaterialized<T extends object>(entity: T): Promise<T> {
    if (this.materialization.length === 0) return entity;
    const ev = { entityType: entity.constructor };
    let instance: object = entity;
    for (const ic of this.materialization) {
      try {
        const updated = await ic.initialized?.(ev, instance);
        if (updated !== undefined) instance = updated;
      } catch (e) {
        logInternalError('InterceptorDispatcher.entityMaterialized', e);
      }
    }
    return instance as T;
  }
}
