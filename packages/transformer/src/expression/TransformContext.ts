import type * as ts from 'typescript';

import type { DiagnosticSink } from '../diagnostics/DiagnosticSink';

export interface TransformContext {
  readonly ctx: ts.TransformationContext;
  readonly sink: DiagnosticSink | undefined;
  readonly methodName: string;
  readonly paramName: string;
  /** Captured runtime values; ParameterRef index = array position. */
  readonly parameters: ts.Expression[];
  /**
   * Recursive entry point for sub-expressions.
   * Visitors call `tctx.recurse(node, depth + 1)` instead of importing
   * transformExpression directly — this breaks the ExpressionDispatcher → visitor
   * → transformExpression → ExpressionDispatcher circular import chain.
   */
  readonly recurse: (node: ts.Expression, depth: number) => ts.Expression;
}
