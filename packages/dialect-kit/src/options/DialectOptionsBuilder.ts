/**
 * Shared per-dialect option builder. Mirrors EF Core's provider-extension pattern:
 *   `optionsBuilder.UseNpgsql(conn, pg => pg.MaxBatchSize(100))`
 *
 * Single source of truth for what was three byte-identical classes
 * (`PostgresOptionsBuilder` / `MysqlOptionsBuilder` / `MssqlOptionsBuilder`). Each dialect
 * package keeps its own exported name as a thin subclass so the published API is unchanged.
 *
 * Usage:
 *   const opts = new PostgresOptionsBuilder().maxBatchSize(100).build();
 *   // pass opts.maxBatchSize to DbContextOptionsBuilder.maxBatchSize(...)
 */
export class DialectOptionsBuilder {
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
