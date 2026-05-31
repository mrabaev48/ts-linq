/**
 * Per-dialect translator for EF.functions built-ins.
 * Each dialect package provides an implementation of this interface.
 *
 * Optional methods (`iLike`) are only available on dialects that support them.
 * When a method is absent and the visitor encounters that function, it throws
 * `AstSqlGenerationError` with code `UNSUPPORTED_FUNCTION`.
 */
export interface EfFunctionTranslator {
  like(col: string, param: string): string;
  /** PostgreSQL only — case-insensitive LIKE. */
  iLike?(col: string, param: string): string;
  random(): string;
  dateDiffDay(col: string, param: string): string;
  dateDiffMonth(col: string, param: string): string;
  greatest(...args: string[]): string;
  least(...args: string[]): string;
  stDev(col: string): string;
  variance(col: string): string;
}
