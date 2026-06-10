import type { SqlVisitorOptions } from './SqlVisitor';

/**
 * The per-dialect subset of {@link SqlVisitorOptions} — the translators a dialect supplies to the
 * `SqlVisitor` so that spatial / hierarchy / JSON-path / EF.functions predicates render correctly.
 *
 * These four ports are dialect-specific (PostGIS vs `JSON_VALUE` vs `ST_*`), as opposed to the
 * metadata-derived options (`converterResolver`, `jsonAccessRewriter`, `complexAccessRewriter`)
 * which are assembled from entity metadata rather than the dialect.
 */
export type DialectVisitorTranslators = Pick<
  SqlVisitorOptions,
  'spatialTranslator' | 'hierarchyTranslator' | 'efFunctionTranslator' | 'jsonPathTranslator'
>;

/**
 * Optional capability implemented by concrete `SqlDialect`s: exposes the dialect-specific
 * translators the SQL visitor needs. The `query` layer probes for this via {@link hasVisitorSupport}
 * and feeds the result into the visitor options, replacing the former bare `new SqlVisitor()`.
 *
 * Kept separate from `SqlDialect` (which lives in `@ts-linq/types` and cannot reference the
 * `EfFunctionTranslator`/`JsonPathTranslator` types defined here) so the dependency boundaries stay
 * intact: dialects already depend on `@ts-linq/sql-visitor`, so they can implement this additively.
 */
export interface DialectVisitorSupport {
  getVisitorTranslators(): DialectVisitorTranslators;
}

/**
 * Runtime type guard: does the given dialect implement {@link DialectVisitorSupport}?
 * Returns `false` for plain `SqlDialect` implementations (e.g. test dialects) so the visitor
 * factory degrades gracefully to no dialect translators.
 */
export function hasVisitorSupport(dialect: object): dialect is DialectVisitorSupport {
  return typeof (dialect as Partial<DialectVisitorSupport>).getVisitorTranslators === 'function';
}
