import type * as ts from 'typescript';

import type { DiagnosticSink } from './core';
import { createWhereTransformer } from './core';

/**
 * Builds the `ts.CustomTransformers` bundle that applies the ts-linq call rewrite
 * as a `before` transformer.
 *
 * This is the minimal Compiler API integration surface: pass the result to
 * `program.emit(..., customTransformers)` or to any bundler pipeline that accepts
 * `ts.CustomTransformers` (webpack `ts-loader`, rollup TS plugins, ...). The same
 * factory drives `TsLinqMorphProject.emit` and `TsLinqMorphProject.transformSources`.
 *
 * @param program the program that owns the source files being transformed —
 *                its TypeChecker drives the branded-receiver scope guards.
 * @param sink    receives transform-time diagnostics (unsupported expressions,
 *                unresolvable receiver types).
 */
export function createTsLinqCustomTransformers(
  program: ts.Program,
  sink: DiagnosticSink
): ts.CustomTransformers {
  return { before: [createWhereTransformer(program, sink)] };
}
