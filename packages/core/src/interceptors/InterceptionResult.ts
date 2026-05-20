/**
 * Carries the outcome of a pre-execution interceptor hook.
 * Mirrors EF Core's InterceptionResult<T>.
 *
 * When isSuppressed is true, the ORM must skip the actual database operation
 * and use result as the synthetic return value. When isSuppressed is false,
 * result is undefined and the database operation proceeds normally.
 */
export class InterceptionResult<T> {
  private constructor(
    public readonly isSuppressed: boolean,
    public readonly result: T | undefined
  ) {}

  /**
   * Create a suppressed result. The interceptor signals that the ORM should
   * short-circuit the operation and return value as its outcome.
   */
  static SuppressWithResult<T>(value: T): InterceptionResult<T> {
    return new InterceptionResult<T>(true, value);
  }

  /**
   * Create a non-suppressed result. The ORM proceeds with the operation normally.
   */
  static NoResult<T>(): InterceptionResult<T> {
    return new InterceptionResult<T>(false, undefined);
  }
}
