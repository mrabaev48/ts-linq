import * as ts from 'typescript';

import { type DiagnosticSink, reportDiagnostic } from '../diagnostics/DiagnosticSink';

// ─── Literal constructors ──────────────────────────────────────────────────────

export function str(text: string): ts.StringLiteral {
  return ts.factory.createStringLiteral(text);
}

export function num(value: string | number): ts.NumericLiteral {
  return ts.factory.createNumericLiteral(String(value));
}

// ─── Object / array builders ──────────────────────────────────────────────────

export function prop(key: string, value: ts.Expression): ts.PropertyAssignment {
  return ts.factory.createPropertyAssignment(ts.factory.createIdentifier(key), value);
}

export function makeObject(
  properties: ts.PropertyAssignment[],
  multiLine = true
): ts.ObjectLiteralExpression {
  return ts.factory.createObjectLiteralExpression(properties, multiLine);
}

export function makeArray(items: ts.Expression[]): ts.ArrayLiteralExpression {
  return ts.factory.createArrayLiteralExpression(items, false);
}

// ─── Syntax kind naming ───────────────────────────────────────────────────────

export function syntaxKindName(kind: ts.SyntaxKind): string {
  const FRIENDLY: Partial<Record<ts.SyntaxKind, string>> = {
    [ts.SyntaxKind.ConditionalExpression]: 'ternary operator (?:)',
    [ts.SyntaxKind.QuestionQuestionToken]: 'nullish coalescing (??)',
    [ts.SyntaxKind.QuestionDotToken]: 'optional chaining (?.)',
    [ts.SyntaxKind.CallExpression]: 'unsupported function call',
    [ts.SyntaxKind.ArrowFunction]: 'nested arrow function',
    [ts.SyntaxKind.TypeOfExpression]: 'typeof expression',
    [ts.SyntaxKind.VoidExpression]: 'void expression',
    [ts.SyntaxKind.AwaitExpression]: 'await expression',
    [ts.SyntaxKind.SpreadElement]: 'spread operator (...)',
    [ts.SyntaxKind.ElementAccessExpression]: 'computed property access (u[key])',
    [ts.SyntaxKind.NewExpression]: 'new expression',
    [ts.SyntaxKind.TemplateExpression]: 'template literal with substitutions',
    [ts.SyntaxKind.Identifier]: 'bare identifier (use u.propertyName)'
  };
  return (
    FRIENDLY[kind] ??
    (ts.SyntaxKind as unknown as Record<number, string | undefined>)[kind] ??
    `SyntaxKind(${kind})`
  );
}

const SUPPORTED_SUMMARY =
  'Allowed: comparisons (>, <, >=, <=, ===, !==), ' +
  'logical (&&, ||), negation (!), ' +
  'null checks (=== null / !== null), ' +
  'string methods (.includes(), .startsWith(), .endsWith()), ' +
  'IN pattern ([...].includes(u.field) or arr.includes(u.field)), ' +
  'literals (string, number, boolean, null), ' +
  'external variable references.';

/**
 * Build an `{ type: "unsupported", syntaxKind, description }` sentinel and
 * optionally emit a compiler ERROR diagnostic pointing at the offending node.
 */
export function makeUnsupported(node: ts.Node, sink?: DiagnosticSink): ts.ObjectLiteralExpression {
  const kind = node.kind;
  const name = syntaxKindName(kind);
  const message =
    `where() predicate contains unsupported expression: ${name}. ` + SUPPORTED_SUMMARY;

  if (sink !== undefined) {
    reportDiagnostic(sink, node, message, ts.DiagnosticCategory.Error);
  }

  return makeObject([
    prop('type', str('unsupported')),
    prop('syntaxKind', num(kind)),
    prop('description', str(message))
  ]);
}
