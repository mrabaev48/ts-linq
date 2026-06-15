// Reserved for future compile-time optimisation (P2-44 — Compiled models / AOT prep).
export type { EFCompileQueryVisitorVersion } from './visitors/EFCompileQueryVisitor';

/**
 * ts-patch entrypoint for the ts-linq compile-time transformer.
 *
 * Rewrites `.where(u => ...)`, `.having(u => ...)` and `.select(e => ...)` calls on
 * `@ts-linq/query` Queryable/TypedQueryable instances into their `*Compiled` equivalents.
 * Scope detection uses the type-brand `__tsLinqWhereTransformerBrand`.
 *
 * Thin adapter over the shared {@link buildVisitor}: differs from `createWhereTransformer`
 * only in obtaining the {@link DiagnosticSink} from the (ts-patch-augmented) context.
 */

import * as ts from 'typescript';

import { buildVisitor } from './CallRewriteVisitor';
import { extractSinkFromCtx } from './diagnostics';

export default function tsLinqTransformer(
  program: ts.Program,
  _pluginConfig: unknown,
  _extras?: unknown
): ts.TransformerFactory<ts.SourceFile> {
  const checker = program.getTypeChecker();

  return (ctx) => (sourceFile) => {
    if (sourceFile.isDeclarationFile) return sourceFile;
    const sink = extractSinkFromCtx(ctx);
    return ts.visitEachChild(sourceFile, buildVisitor(ctx, checker, sink), ctx);
  };
}
