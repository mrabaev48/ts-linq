import type { DatabaseProvider } from '@ts-linq/core';

import { createDiagnosticSink } from '../context/DiagnosticSink';

/**
 * Represents an active database transaction returned by `context.database.beginTransactionAsync()`.
 * Mirrors EF Core's `IDbContextTransaction`.
 *
 * Supports named savepoints for fine-grained partial rollbacks and implements
 * `AsyncDisposable` so the transaction is automatically rolled back when exiting
 * an `await using` scope without an explicit commit.
 *
 * @example
 * await using const tx = await context.database.beginTransactionAsync();
 * try {
 *   await context.saveChanges();
 *   await tx.createSavepointAsync('before_risky');
 *
 *   try { await doRisky(); }
 *   catch { await tx.rollbackToSavepointAsync('before_risky'); }
 *
 *   await tx.releaseSavepointAsync('before_risky');
 *   await tx.commitAsync();
 * } catch { await tx.rollbackAsync(); }
 */
export class DbContextTransaction implements AsyncDisposable {
  private _disposed = false;

  constructor(
    private readonly _provider: DatabaseProvider,
    private readonly _commit: () => Promise<void>,
    private readonly _rollback: () => Promise<void>
  ) {}

  /**
   * Create a named savepoint at the current point in the transaction.
   * Subsequent work can be rolled back to this savepoint without aborting the whole transaction.
   */
  async createSavepointAsync(name: string): Promise<void> {
    await this._provider.createSavepoint(name);
  }

  /**
   * Roll back all changes made after the named savepoint was created.
   * The savepoint itself is still accessible after this call.
   */
  async rollbackToSavepointAsync(name: string): Promise<void> {
    await this._provider.rollbackToSavepoint(name);
  }

  /**
   * Release (destroy) the named savepoint.
   * On providers that do not support RELEASE (e.g. SQL Server) this is a no-op.
   */
  async releaseSavepointAsync(name: string): Promise<void> {
    await this._provider.releaseSavepoint(name);
  }

  /** Commit all changes made within this transaction. */
  async commitAsync(): Promise<void> {
    if (!this._disposed) {
      this._disposed = true;
      await this._commit();
    }
  }

  /** Roll back all changes made within this transaction. */
  async rollbackAsync(): Promise<void> {
    if (!this._disposed) {
      this._disposed = true;
      await this._rollback();
    }
  }

  /**
   * Automatically called at the end of an `await using` scope.
   * Rolls back the transaction if it has not been explicitly committed or rolled back.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    if (!this._disposed) {
      this._disposed = true;
      try {
        await this._rollback();
      } catch (e) {
        // Cleanup-with-swallow: a dispose-time rollback may fail because the
        // transaction is already gone. Never rethrow from `asyncDispose`, but log
        // at warn so the failure is observable instead of silently dropped.
        createDiagnosticSink(this._provider.loggerRef).internalDiag(
          'DbContextTransaction.asyncDispose.rollback',
          e
        );
      }
    }
  }
}
