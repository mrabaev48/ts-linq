/**
 * Fluent builder for user-defined database functions registered via
 * `ModelBuilder.hasDbFunction()`. Mirrors EF Core's `DbFunctionBuilder`.
 */
export class DbFunctionBuilder {
  private _sqlName?: string;

  constructor(private readonly _fn: Function) {}

  /**
   * Sets the SQL function name to use when generating queries.
   * Mirrors EF Core's `DbFunctionBuilder.HasName()`.
   */
  hasName(sqlName: string): this {
    this._sqlName = sqlName;
    return this;
  }

  /** Returns the registered SQL function name, if set. */
  getSqlName(): string | undefined {
    return this._sqlName;
  }

  /** Returns the original method reference passed to `hasDbFunction`. */
  getFn(): Function {
    return this._fn;
  }
}
