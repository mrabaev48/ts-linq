/**
 * Per-dialect option builder for MySQL.
 * Mirrors EF Core's provider-extension pattern:
 *   `optionsBuilder.UseMySql(conn, my => my.MaxBatchSize(50))`
 *
 * Usage:
 *   const opts = new MysqlOptionsBuilder().maxBatchSize(50).build();
 *   // pass opts.maxBatchSize to DbContextOptionsBuilder.maxBatchSize(...)
 */
export class MysqlOptionsBuilder {
  private _maxBatchSize?: number;

  /**
   * Cap the number of rows per batch SQL statement.
   * Mirrors EF Core's `UseMySql(conn, o => o.MaxBatchSize(n))`.
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
