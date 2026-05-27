/**
 * Per-dialect option builder for PostgreSQL.
 * Mirrors EF Core's provider-extension pattern:
 *   `optionsBuilder.UseNpgsql(conn, pg => pg.MaxBatchSize(100))`
 *
 * Usage:
 *   const pgOpts = new PostgresOptionsBuilder().maxBatchSize(100).build();
 *   // pass pgOpts.maxBatchSize to DbContextOptionsBuilder.maxBatchSize(...)
 */
export class PostgresOptionsBuilder {
  private _maxBatchSize?: number;

  /**
   * Cap the number of rows per batch SQL statement.
   * Mirrors EF Core's `UseNpgsql(conn, o => o.MaxBatchSize(n))`.
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
