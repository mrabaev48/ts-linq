import * as ts from 'typescript';

import type { DiagnosticSink } from '../diagnostics/DiagnosticSink';
import { reportDiagnostic } from '../diagnostics/DiagnosticSink';
import type { TransformContext } from '../expression/TransformContext';
import { transformExpression } from '../expression/transformExpression';
import { makeArray, makeObject, prop } from '../nodes/builders';
import { receiverIsQueryable } from '../scope/QueryableGuard';

export function rewriteCall(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  ctx: ts.TransformationContext,
  sink: DiagnosticSink | undefined
): ts.CallExpression | null {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;

  const methodName = expr.name.text;
  const receiver = expr.expression;
  if (!receiverIsQueryable(checker, receiver)) return null;

  const arg0 = call.arguments[0];
  if (arg0 === undefined) return null;

  if (!ts.isArrowFunction(arg0)) {
    reportDiagnostic(
      sink,
      arg0,
      `${methodName}() predicate must be an arrow function, not ${ts.SyntaxKind[arg0.kind]}.`
    );
    return call;
  }

  if (ts.isBlock(arg0.body)) {
    reportDiagnostic(
      sink,
      arg0.body,
      `${methodName}() predicate must be a concise arrow (expression body, not a block statement).`
    );
    return call;
  }

  const firstParam = arg0.parameters[0];
  if (!firstParam || !ts.isIdentifier(firstParam.name)) {
    reportDiagnostic(
      sink,
      arg0,
      `${methodName}() predicate must have exactly one identifier parameter.`
    );
    return call;
  }

  const paramName = firstParam.name.text;
  const parameters: ts.Expression[] = [];

  // Self-referential context: `recurse` closes over `tctx` via `let`+definite assignment.
  let tctx!: TransformContext;
  tctx = {
    ctx,
    sink,
    methodName,
    paramName,
    parameters,
    recurse: (n: ts.Expression, d: number) => transformExpression(n, tctx, d)
  };

  const astNode = transformExpression(arg0.body, tctx);

  const compiledArg = makeObject([prop('ast', astNode), prop('parameters', makeArray(parameters))]);

  const compiledMethod = `${methodName}Compiled`;
  const callee = ts.factory.createPropertyAccessExpression(receiver, compiledMethod);
  return ts.factory.createCallExpression(callee, call.typeArguments, [compiledArg]);
}
