/**
 * @ts-linq/transformer-morph — ts-patch-free replacement for `@ts-linq/transformer`,
 * built on ts-morph (project model / analysis) and the TypeScript Compiler API
 * (transform / emit).
 *
 * The rewrite core (`src/core`) is a full port of the `@ts-linq/transformer`
 * pipeline — rewriters, expression conversion, scope guards, diagnostics — so this
 * package has no dependency on the legacy ts-patch package and emits byte-compatible
 * call shapes (`whereCompiled` / `havingCompiled` / `selectCompiled` / query filters).
 */

export type { CliOptions, CliParseResult } from './cli';
export { parseCliArgs, runCli } from './cli';
export {
  buildVisitor,
  createDiagnostic,
  createWhereTransformer,
  type DiagnosticSink,
  type EFCompileQueryVisitorVersion,
  reportDiagnostic,
  TS_LINQ_DIAGNOSTIC_CODE
} from './core';
export { createTsLinqCustomTransformers } from './customTransformers';
export { DiagnosticCollector, formatDiagnostics } from './DiagnosticCollector';
export type {
  MorphEmitResult,
  RewriteCandidate,
  SourceTransformResult,
  TransformedSourceFile,
  TsLinqMorphProjectOptions
} from './TsLinqMorphProject';
export { TsLinqMorphProject } from './TsLinqMorphProject';
