import * as ts from 'typescript';

import type { DiagnosticSink } from '../../../src/core/diagnostics/DiagnosticSink';
import type { TransformContext } from '../../../src/core/expression/TransformContext';
import { transformExpression } from '../../../src/core/expression/transformExpression';

export interface MockSink {
  readonly sink: DiagnosticSink;
  readonly calls: ts.Diagnostic[];
}

export function makeSink(): MockSink {
  const calls: ts.Diagnostic[] = [];
  const sink: DiagnosticSink = {
    addDiagnostic: (d: ts.Diagnostic) => {
      calls.push(d);
    }
  };
  return { sink, calls };
}

export function makeTestContext(
  paramName = 'u',
  methodName = 'where',
  sink?: DiagnosticSink
): TransformContext {
  const mockCtx = {} as ts.TransformationContext;
  const parameters: ts.Expression[] = [];

  let tctx!: TransformContext;
  tctx = {
    ctx: mockCtx,
    sink,
    methodName,
    paramName,
    parameters,
    recurse: (n: ts.Expression, d: number) => transformExpression(n, tctx, d)
  };
  return tctx;
}

/**
 * Parse a TypeScript expression from a source string.
 * Returns the first expression statement's expression.
 */
export function parseExpr(code: string): ts.Expression {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    code,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS
  );
  const stmt = sourceFile.statements[0];
  if (!stmt || !ts.isExpressionStatement(stmt)) {
    throw new Error(`Expected expression statement, got: ${code}`);
  }
  return stmt.expression;
}

/** Extract the printed text of a TS ObjectLiteralExpression for simple inspection. */
export function printNode(node: ts.Node): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const dummy = ts.createSourceFile('print.ts', '', ts.ScriptTarget.ES2020, false);
  return printer.printNode(ts.EmitHint.Unspecified, node, dummy);
}
