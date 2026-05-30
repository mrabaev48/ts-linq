import * as ts from 'typescript';

import type { DiagnosticSink } from '../diagnostics/DiagnosticSink';
import { reportDiagnostic } from '../diagnostics/DiagnosticSink';
import type { TransformContext } from '../expression/TransformContext';
import { transformExpression } from '../expression/transformExpression';
import { makeArray, makeObject, prop } from '../nodes/builders';
import { receiverIsEntityTypeBuilder } from '../scope/EntityTypeBuilderGuard';

export function rewriteHasQueryFilterCall(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  ctx: ts.TransformationContext,
  sink: DiagnosticSink | undefined
): ts.CallExpression | null {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;

  const receiver = expr.expression;
  if (!receiverIsEntityTypeBuilder(checker, receiver)) return null;

  const args = call.arguments;

  // Determine which overload: (pred) or (name, pred)
  let nameArg: ts.Expression | undefined;
  let predicateArg: ts.ArrowFunction | undefined;

  if (args.length === 1) {
    // hasQueryFilter(pred)
    if (!ts.isArrowFunction(args[0])) {
      reportDiagnostic(
        sink,
        args[0],
        `hasQueryFilter() predicate must be an arrow function, not ${ts.SyntaxKind[args[0].kind]}.`
      );
      return call;
    }
    predicateArg = args[0] as ts.ArrowFunction;
  } else if (args.length === 2) {
    // hasQueryFilter(name, pred)
    if (!ts.isStringLiteral(args[0]) && !ts.isStringLiteralLike(args[0])) {
      reportDiagnostic(
        sink,
        args[0],
        'hasQueryFilter() first argument must be a string literal name.'
      );
      return call;
    }
    nameArg = args[0];
    if (!ts.isArrowFunction(args[1])) {
      reportDiagnostic(
        sink,
        args[1],
        `hasQueryFilter() predicate must be an arrow function, not ${ts.SyntaxKind[args[1].kind]}.`
      );
      return call;
    }
    predicateArg = args[1] as ts.ArrowFunction;
  } else {
    return null;
  }

  if (ts.isBlock(predicateArg.body)) {
    reportDiagnostic(
      sink,
      predicateArg.body,
      'hasQueryFilter() predicate must be a concise arrow (expression body, not a block statement).'
    );
    return call;
  }

  const firstParam = predicateArg.parameters[0];
  if (!firstParam || !ts.isIdentifier(firstParam.name)) {
    reportDiagnostic(
      sink,
      predicateArg,
      'hasQueryFilter() predicate must have exactly one identifier parameter.'
    );
    return call;
  }

  const paramName = firstParam.name.text;
  const parameters: ts.Expression[] = [];

  let tctx!: TransformContext;
  tctx = {
    ctx,
    sink,
    methodName: 'hasQueryFilter',
    paramName,
    parameters,
    recurse: (n: ts.Expression, d: number) => transformExpression(n, tctx, d)
  };

  const astNode = transformExpression(predicateArg.body as ts.Expression, tctx);
  const compiledArg = makeObject([prop('ast', astNode), prop('parameters', makeArray(parameters))]);

  const callee = ts.factory.createPropertyAccessExpression(receiver, 'hasQueryFilterCompiled');

  const newArgs: ts.Expression[] = nameArg ? [nameArg, compiledArg] : [compiledArg];
  return ts.factory.createCallExpression(callee, call.typeArguments, newArgs);
}
