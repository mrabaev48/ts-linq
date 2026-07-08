/**
 * Rewrite core — pure TypeScript Compiler API, no ts-morph imports allowed here.
 *
 * Ported from `@ts-linq/transformer` (rewriters, expression pipeline, scope guards,
 * node builders, diagnostics) so this package replaces it without ts-patch. The
 * emitted call shapes (`whereCompiled` / `havingCompiled` / `selectCompiled` /
 * compiled query filters) are byte-compatible with the original transformer.
 */

export { buildVisitor } from './CallRewriteVisitor';
export { createWhereTransformer } from './createWhereTransformer';
export {
  createDiagnostic,
  type DiagnosticSink,
  reportDiagnostic,
  TS_LINQ_DIAGNOSTIC_CODE
} from './diagnostics';
// Reserved for future compile-time optimisation (P2-44 — Compiled models / AOT prep).
export type { EFCompileQueryVisitorVersion } from './visitors/EFCompileQueryVisitor';
