import type { SavepointStrategy } from '@ts-linq/core';

/**
 * SQL Server savepoint strategy.
 *
 * T-SQL uses `SAVE TRANSACTION` / `ROLLBACK TRANSACTION` and has **no** RELEASE
 * concept, so `releaseSql` returns `null` (no-op).
 */
export class MssqlSavepointStrategy implements SavepointStrategy {
  public createSql(name: string): string {
    return `SAVE TRANSACTION ${name}`;
  }

  public rollbackToSql(name: string): string {
    return `ROLLBACK TRANSACTION ${name}`;
  }

  public releaseSql(): null {
    return null;
  }
}
