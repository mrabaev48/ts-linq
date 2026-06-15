import * as ts from 'typescript';

import type { DiagnosticSink } from '../diagnostics/DiagnosticSink';
import { reportDiagnostic } from '../diagnostics/DiagnosticSink';
import { makeArray, makeObject, prop, str } from '../nodes/builders';
import { receiverIsQueryable } from '../scope/QueryableGuard';

export function rewriteSelectCall(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  _ctx: ts.TransformationContext,
  sink: DiagnosticSink | undefined
): ts.CallExpression | null {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;

  const receiver = expr.expression;
  if (!receiverIsQueryable(checker, receiver, 'select', sink)) return null;

  const arg0 = call.arguments[0];
  if (arg0 === undefined) return null;

  if (!ts.isArrowFunction(arg0)) {
    reportDiagnostic(
      sink,
      arg0,
      `select() selector must be an arrow function, not ${ts.SyntaxKind[arg0.kind]}.`
    );
    return call;
  }

  if (ts.isBlock(arg0.body)) {
    reportDiagnostic(
      sink,
      arg0.body,
      `select() selector must be a concise arrow (expression body, not a block statement).`
    );
    return call;
  }

  const firstParam = arg0.parameters[0];
  if (!firstParam || !ts.isIdentifier(firstParam.name)) {
    reportDiagnostic(sink, arg0, `select() selector must have exactly one identifier parameter.`);
    return call;
  }

  const paramName = firstParam.name.text;
  const body = arg0.body;

  // Unwrap parenthesized expression: e => ({ ... }) → ObjectLiteralExpression
  const unwrapped = ts.isParenthesizedExpression(body) ? body.expression : body;

  const fields: ts.StringLiteral[] = [];

  if (ts.isObjectLiteralExpression(unwrapped)) {
    for (const element of unwrapped.properties) {
      if (ts.isPropertyAssignment(element) && ts.isPropertyAccessExpression(element.initializer)) {
        const access = element.initializer;
        if (ts.isIdentifier(access.expression) && access.expression.text === paramName) {
          fields.push(str(access.name.text));
          continue;
        }
      }
      reportDiagnostic(
        sink,
        element,
        `select() projection property must be a simple property access (e.g. { name: e.name }). ` +
          `Computed values, spreads, and method calls are not supported.`
      );
      return call;
    }
  } else if (ts.isPropertyAccessExpression(unwrapped)) {
    if (ts.isIdentifier(unwrapped.expression) && unwrapped.expression.text === paramName) {
      fields.push(str(unwrapped.name.text));
    } else {
      reportDiagnostic(
        sink,
        unwrapped,
        `select() selector must access a property of the entity parameter (e.g. e => e.name).`
      );
      return call;
    }
  } else {
    reportDiagnostic(
      sink,
      unwrapped,
      `select() selector body must be a property access or an object literal (e.g. e => e.name or e => ({ id: e.id })).`
    );
    return call;
  }

  const compiledArg = makeObject([prop('fields', makeArray(fields))]);

  const callee = ts.factory.createPropertyAccessExpression(receiver, 'selectCompiled');
  return ts.factory.createCallExpression(callee, call.typeArguments, [compiledArg]);
}
