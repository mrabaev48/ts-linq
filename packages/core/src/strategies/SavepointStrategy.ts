/**
 * Strategy emitting the dialect-specific SQL for transaction savepoint control.
 *
 * Each method returns the statement to execute, or `null` to signal a no-op
 * (e.g. MSSQL has no `RELEASE SAVEPOINT` concept). The host provider executes
 * the returned SQL via its normal non-query path (overridable per provider when
 * the driver cannot run transaction-control statements through prepared
 * statements — see `DatabaseProvider.runSavepointStatement`).
 */
export interface SavepointStrategy {
  /** SQL creating a named savepoint, or `null` for a no-op. */
  createSql(name: string): string | null;
  /** SQL rolling back to a named savepoint, or `null` for a no-op. */
  rollbackToSql(name: string): string | null;
  /** SQL releasing a named savepoint, or `null` for a no-op. */
  releaseSql(name: string): string | null;
}

/**
 * ANSI-SQL savepoint syntax (`SAVEPOINT` / `ROLLBACK TO SAVEPOINT` /
 * `RELEASE SAVEPOINT`). Default for providers that follow the standard
 * (PostgreSQL, MySQL).
 */
export class AnsiSavepointStrategy implements SavepointStrategy {
  public createSql(name: string): string {
    return `SAVEPOINT ${name}`;
  }

  public rollbackToSql(name: string): string {
    return `ROLLBACK TO SAVEPOINT ${name}`;
  }

  public releaseSql(name: string): string {
    return `RELEASE SAVEPOINT ${name}`;
  }
}
