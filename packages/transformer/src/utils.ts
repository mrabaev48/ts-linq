/**
 * Pure AST-construction helpers for the ts-linq transformer.
 * Every function returns a new immutable ts.Node — no side effects.
 */

import * as ts from 'typescript';

// ─── Literal constructors ─────────────────────────────────────────────────────

export function str(text: string): ts.StringLiteral {
  return ts.factory.createStringLiteral(text);
}

export function num(value: string | number): ts.NumericLiteral {
  return ts.factory.createNumericLiteral(String(value));
}

// ─── Object / array builders ──────────────────────────────────────────────────

export function prop(key: string, value: ts.Expression): ts.PropertyAssignment {
  return ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier(key),
    value
  );
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

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export function emitDiagnostic(
  ctx: ts.TransformationContext,
  node: ts.Node,
  message: string,
  category: ts.DiagnosticCategory = ts.DiagnosticCategory.Warning
): void {
  const diag: ts.Diagnostic = {
    category,
    code: 90_001,
    file: node.getSourceFile(),
    start: node.getStart(),
    length: node.getWidth(),
    messageText: message,
  };
  const c = ctx as unknown as { addDiagnostic?: (d: ts.Diagnostic) => void };
  if (typeof c.addDiagnostic === 'function') {
    c.addDiagnostic(diag);
  } else {
    const prefix = category === ts.DiagnosticCategory.Error ? 'ERROR' : 'WARN';
    process.stderr.write(`[ts-linq-transformer ${prefix}] ${message}\n`);
  }
}

// ─── Unsupported node handling ────────────────────────────────────────────────

export function syntaxKindName(kind: ts.SyntaxKind): string {
  const FRIENDLY: Partial<Record<ts.SyntaxKind, string>> = {
    [ts.SyntaxKind.ConditionalExpression]:   'ternary operator (?:)',
    [ts.SyntaxKind.QuestionQuestionToken]:   'nullish coalescing (??)',
    [ts.SyntaxKind.QuestionDotToken]:        'optional chaining (?.)',
    [ts.SyntaxKind.CallExpression]:          'unsupported function call',
    [ts.SyntaxKind.ArrowFunction]:           'nested arrow function',
    [ts.SyntaxKind.TypeOfExpression]:        'typeof expression',
    [ts.SyntaxKind.VoidExpression]:          'void expression',
    [ts.SyntaxKind.AwaitExpression]:         'await expression',
    [ts.SyntaxKind.SpreadElement]:           'spread operator (...)',
    [ts.SyntaxKind.ElementAccessExpression]: 'computed property access (u[key])',
    [ts.SyntaxKind.NewExpression]:           'new expression',
    [ts.SyntaxKind.TemplateExpression]:      'template literal with substitutions',
    [ts.SyntaxKind.Identifier]:              'bare identifier (use u.propertyName)',
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
 * Build an `{ type: "unsupported", syntaxKind, description }` sentinel AND
 * emit a compiler ERROR diagnostic pointing at the offending source node.
 * The sentinel is still returned so the build continues and shows all errors at once.
 */
export function makeUnsupported(
  node: ts.Node,
  ctx?: ts.TransformationContext
): ts.ObjectLiteralExpression {
  const kind = node.kind;
  const name = syntaxKindName(kind);
  const message =
    `where() predicate contains unsupported expression: ${name}. ` +
    SUPPORTED_SUMMARY;

  if (ctx !== undefined) {
    emitDiagnostic(ctx, node, message, ts.DiagnosticCategory.Error);
  }

  return makeObject([
    prop('type',        str('unsupported')),
    prop('syntaxKind',  num(kind)),
    prop('description', str(message)),
  ]);
}

// ─── Property path unwinding ──────────────────────────────────────────────────

export interface PropertyChain {
  root:        string;
  segments:    string[];
  hasOptional: boolean;
}

export const MAX_CHAIN_DEPTH = 20;

function isOptionalAccess(node: ts.PropertyAccessExpression): boolean {
  return (
    (node as ts.PropertyAccessExpression & { questionDotToken?: unknown })
      .questionDotToken !== undefined
  );
}

/**
 * Unwind a PropertyAccessExpression chain into root identifier + segments.
 * Returns null when the leftmost node is not a plain Identifier or depth exceeds MAX_CHAIN_DEPTH.
 */
export function collectPropertyChain(
  node: ts.PropertyAccessExpression
): PropertyChain | null {
  const segments: string[] = [];
  let current: ts.Expression = node;
  let depth = 0;
  let hasOptional = false;

  while (ts.isPropertyAccessExpression(current)) {
    if (++depth > MAX_CHAIN_DEPTH) return null;
    if (isOptionalAccess(current)) hasOptional = true;
    segments.unshift(current.name.text);
    current = current.expression;
  }

  if (!ts.isIdentifier(current)) return null;
  return { root: current.text, segments, hasOptional };
}
