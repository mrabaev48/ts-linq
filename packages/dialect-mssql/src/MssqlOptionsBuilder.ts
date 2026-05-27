/**
 * Per-dialect option builder for SQL Server.
 * Mirrors EF Core's provider-extension pattern:
 *   `optionsBuilder.UseSqlServer(conn, sql => sql.MaxBatchSize(50))`
 *
 * Usage:
 *   const opts = new MssqlOptionsBuilder().maxBatchSize(50).build();
 *   // pass opts.maxBatchSize to DbContextOptionsBuilder.maxBatchSize(...)
 */
export class MssqlOptionsBuilder {
  private _maxBatchSize?: number;

  /**
   * Cap the number of rows per batch SQL statement.
   * Mirrors EF Core's `UseSqlServer(conn, o => o.MaxBatchSize(n))`.
   */
  maxBatchSize(n: number): this {
    this._maxBatchSize = n;
    return this;
  }

  build(): { maxBatchSize?: number } {
    return {
      ...(this._maxBatchSize !== undefined ? { maxBatchSize: this._maxBatchSize } : {})
    };
  }
}
