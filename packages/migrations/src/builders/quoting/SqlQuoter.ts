/**
 * The single injection-safe quoting authority for a dialect.
 *
 * Every identifier and literal that reaches emitted SQL (DDL / DML / seed / sequence)
 * MUST go through an implementation of this interface. Implementations are responsible
 * for escaping embedded quote characters so a crafted name or value cannot break out of
 * its quoting and inject arbitrary SQL into a generated migration.
 *
 * This is Clean Architecture's "details at the edge": dialect-specific escaping lives
 * behind a stable interface that the builders depend on (Strategy), and is selected via
 * {@link QuoterFactory} (Factory). The legacy `q`/`formatValue` helpers in `SqlUtils`
 * are thin facades over this interface (Facade).
 */
export interface SqlQuoter {
  /** Escapes embedded quote characters and wraps a single identifier. */
  id(identifier: string): string;

  /** Quotes each part with {@link id} and joins them with `.` (e.g. `schema.name`). */
  qualified(...parts: string[]): string;

  /** The single audited literal-encoding path (folds the legacy `formatValue`). */
  literal(value: unknown): string;
}
