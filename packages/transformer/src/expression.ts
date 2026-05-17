/**
 * Core recursive transformer: TypeScript AST expression → ExpressionNode object literal.
 *
 * Supported source patterns:
 *   u.age > 18                         → BinaryNode
 *   u.age > 18 && u.active === true    → LogicalNode (AND)
 *   u.age > 18 || u.vip === true       → LogicalNode (OR)
 *   !u.banned                          → NotNode
 *   u.name.includes("foo")             → MethodNode
 *   u.name.startsWith("a")            → MethodNode
 *   u.name.endsWith(".ts")            → MethodNode
 *   ["a","b"].includes(u.role)         → InNode (inline array literal)
 *   roles.includes(u.role)             → InNode (external array variable → ParameterRef)
 *   u.deletedAt === null               → IsNullNode
 *   u.deletedAt !== null               → IsNotNullNode
 *   u.profile.name                     → PropertyNode (multi-segment path)
 *   minAge / "foo" / true / null       → LiteralNode
 *   someVar                            → ParameterRefNode (captured at compile time)
 *   (expr)                             → transparent unwrap
 *
 * Unsupported (emit compiler error + UnsupportedNode sentinel):
 *   u?.age         optional chaining on call
 *   cond ? a : b   ternary
 *   typeof x       typeof
 *   u[key]         computed access
 *   other calls
 */

import * as ts from 'typescript';

import {
  collectPropertyChain,
  emitDiagnostic,
  makeArray,
  makeObject,
  makeUnsupported,
  num,
  prop,
  str,
  syntaxKindName
} from './utils';

const MAX_DEPTH = 64;

export interface TransformContext {
  ctx: ts.TransformationContext;
  methodName: string;
  paramName: string;
  /** Captured runtime values; ParameterRef index = array position. */
  parameters: ts.Expression[];
}

// ─── Public entry ─────────────────────────────────────────────────────────────

export function transformExpression(
  node: ts.Expression,
  tctx: TransformContext,
  depth = 0
): ts.Expression {
  if (depth > MAX_DEPTH) return makeUnsupported(node, tctx.ctx);

  const recurse = (n: ts.Expression): ts.Expression => transformExpression(n, tctx, depth + 1);

  // ── 1. Parenthesised — unwrap ─────────────────────────────────────────────
  if (ts.isParenthesizedExpression(node)) {
    return recurse(node.expression);
  }

  // ── 2. Prefix unary: ! and -number ───────────────────────────────────────
  if (ts.isPrefixUnaryExpression(node)) {
    return transformPrefixUnary(node, tctx, depth);
  }

  // ── 3. Optional call (unsupported) ────────────────────────────────────────
  if (
    ts.isCallExpression(node) &&
    (node as ts.CallExpression & { questionDotToken?: unknown }).questionDotToken !== undefined
  ) {
    return makeUnsupported(node, tctx.ctx);
  }

  // ── 4. Call expression ────────────────────────────────────────────────────
  if (ts.isCallExpression(node)) {
    return transformCallExpression(node, tctx, depth);
  }

  // ── 5. Binary expression ──────────────────────────────────────────────────
  if (ts.isBinaryExpression(node)) {
    return transformBinaryExpression(node, tctx, depth);
  }

  // ── 6. Property access: u.age, u.profile.name ─────────────────────────────
  if (ts.isPropertyAccessExpression(node)) {
    return transformPropertyAccess(node, tctx);
  }

  // ── 7. Identifier: external variable reference ────────────────────────────
  if (ts.isIdentifier(node)) {
    return transformIdentifier(node, tctx);
  }

  // ── 8. Numeric literal ────────────────────────────────────────────────────
  if (ts.isNumericLiteral(node)) return makeLiteral(num(node.text));

  // ── 9. String literal ─────────────────────────────────────────────────────
  if (ts.isStringLiteral(node)) return makeLiteral(str(node.text));

  // ── 10. No-substitution template literal ──────────────────────────────────
  if (ts.isNoSubstitutionTemplateLiteral(node)) return makeLiteral(str(node.text));

  // ── 11. Boolean / null keywords ───────────────────────────────────────────
  if (node.kind === ts.SyntaxKind.TrueKeyword) return makeLiteral(ts.factory.createTrue());
  if (node.kind === ts.SyntaxKind.FalseKeyword) return makeLiteral(ts.factory.createFalse());
  if (node.kind === ts.SyntaxKind.NullKeyword) return makeLiteral(ts.factory.createNull());

  return makeUnsupported(node, tctx.ctx);
}

// ─── Prefix unary ─────────────────────────────────────────────────────────────

function transformPrefixUnary(
  node: ts.PrefixUnaryExpression,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  // `!expr` → NotNode
  if (node.operator === ts.SyntaxKind.ExclamationToken) {
    return makeObject([
      prop('type', str('not')),
      prop('operand', transformExpression(node.operand, tctx, depth + 1))
    ]);
  }

  // `-number` → negative LiteralNode
  if (node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return makeObject([
      prop('type', str('literal')),
      prop(
        'value',
        ts.factory.createPrefixUnaryExpression(
          ts.SyntaxKind.MinusToken,
          ts.factory.createNumericLiteral(node.operand.text)
        )
      )
    ]);
  }

  // `+number`
  if (node.operator === ts.SyntaxKind.PlusToken && ts.isNumericLiteral(node.operand)) {
    return makeLiteral(num(node.operand.text));
  }

  return makeUnsupported(node, tctx.ctx);
}

// ─── Call expressions ─────────────────────────────────────────────────────────

function transformCallExpression(
  node: ts.CallExpression,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return makeUnsupported(node, tctx.ctx);
  }

  const callee = node.expression;
  const receiver = callee.expression;
  const method = callee.name.text;
  const arg0 = node.arguments[0] as ts.Expression | undefined;

  // Pattern B: ["a","b"].includes(u.role)
  if (method === 'includes' && ts.isArrayLiteralExpression(receiver) && arg0 !== undefined) {
    return transformArrayIncludes(receiver, arg0, tctx);
  }

  // Pattern C: roles.includes(u.role)
  if (
    method === 'includes' &&
    ts.isIdentifier(receiver) &&
    receiver.text !== tctx.paramName &&
    arg0 !== undefined
  ) {
    return transformIdentifierIncludes(receiver, arg0, tctx);
  }

  // Pattern A: u.name.includes / startsWith / endsWith
  const STRING_METHODS = new Set(['includes', 'startsWith', 'endsWith']);
  if (STRING_METHODS.has(method) && ts.isPropertyAccessExpression(receiver)) {
    return transformStringMethod(method, receiver, node.arguments, tctx, depth);
  }

  return makeUnsupported(node, tctx.ctx);
}

/** ["admin", "mod"].includes(u.role) → InNode with inline values */
function transformArrayIncludes(
  arrayNode: ts.ArrayLiteralExpression,
  argNode: ts.Expression,
  tctx: TransformContext
): ts.Expression {
  const propExpr = extractPropertyNode(argNode, tctx.paramName);
  if (propExpr === null) return makeUnsupported(argNode, tctx.ctx);

  const valueLiterals: ts.Expression[] = [];
  for (const el of arrayNode.elements) {
    const lit = extractArrayElementLiteral(el, tctx.ctx);
    valueLiterals.push(lit);
  }

  return makeObject([
    prop('type', str('in')),
    prop('property', propExpr),
    prop(
      'values',
      makeArray(
        valueLiterals.map((v) => makeObject([prop('type', str('literal')), prop('value', v)]))
      )
    )
  ]);
}

function extractArrayElementLiteral(
  el: ts.Expression,
  ctx: ts.TransformationContext
): ts.Expression {
  if (ts.isStringLiteral(el)) return str(el.text);
  if (ts.isNumericLiteral(el)) return num(el.text);
  if (el.kind === ts.SyntaxKind.TrueKeyword) return ts.factory.createTrue();
  if (el.kind === ts.SyntaxKind.FalseKeyword) return ts.factory.createFalse();
  if (el.kind === ts.SyntaxKind.NullKeyword) return ts.factory.createNull();
  if (
    ts.isPrefixUnaryExpression(el) &&
    el.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(el.operand)
  ) {
    return ts.factory.createPrefixUnaryExpression(
      ts.SyntaxKind.MinusToken,
      ts.factory.createNumericLiteral(el.operand.text)
    );
  }
  // Non-literal array element — emit unsupported sentinel for that slot
  return makeUnsupported(el, ctx);
}

/** roles.includes(u.role) → InNode with valuesRef (ParameterRef index) */
function transformIdentifierIncludes(
  identNode: ts.Identifier,
  argNode: ts.Expression,
  tctx: TransformContext
): ts.Expression {
  const propExpr = extractPropertyNode(argNode, tctx.paramName);
  if (propExpr === null) return makeUnsupported(argNode, tctx.ctx);

  // Capture the external array as a runtime parameter
  const idx = tctx.parameters.length;
  tctx.parameters.push(identNode);

  return makeObject([
    prop('type', str('in')),
    prop('property', propExpr),
    prop('valuesRef', num(idx))
  ]);
}

/** u.name.includes("foo") → MethodNode */
function transformStringMethod(
  method: string,
  receiverAccess: ts.PropertyAccessExpression,
  args: ts.NodeArray<ts.Expression>,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  const chain = collectPropertyChain(receiverAccess);
  if (chain === null || chain.root !== tctx.paramName) {
    return makeUnsupported(receiverAccess, tctx.ctx);
  }

  const propNode = buildPropertyNode(chain.segments, chain.hasOptional);
  const argExprs = Array.from(args).map((a) => {
    const transformed = transformExpression(a, tctx, depth + 1);
    // Only LiteralNode and ParameterRefNode are valid method args
    return transformed;
  });

  return makeObject([
    prop('type', str('method')),
    prop('method', str(method)),
    prop('object', propNode),
    prop('args', makeArray(argExprs))
  ]);
}

// ─── Binary expression ────────────────────────────────────────────────────────

const LOGICAL_OPS: Partial<Record<ts.SyntaxKind, '&&' | '||'>> = {
  [ts.SyntaxKind.AmpersandAmpersandToken]: '&&',
  [ts.SyntaxKind.BarBarToken]: '||'
};

const COMPARISON_OPS: Partial<
  Record<ts.SyntaxKind, '==' | '===' | '!=' | '!==' | '>' | '<' | '>=' | '<='>
> = {
  [ts.SyntaxKind.EqualsEqualsToken]: '==',
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: '===',
  [ts.SyntaxKind.ExclamationEqualsToken]: '!=',
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: '!==',
  [ts.SyntaxKind.GreaterThanToken]: '>',
  [ts.SyntaxKind.LessThanToken]: '<',
  [ts.SyntaxKind.GreaterThanEqualsToken]: '>=',
  [ts.SyntaxKind.LessThanEqualsToken]: '<='
};

function transformBinaryExpression(
  node: ts.BinaryExpression,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  const opKind = node.operatorToken.kind;

  // Logical && / ||
  const logicalOp = LOGICAL_OPS[opKind];
  if (logicalOp !== undefined) {
    return makeObject([
      prop('type', str('logical')),
      prop('operator', str(logicalOp)),
      prop('left', transformExpression(node.left, tctx, depth + 1)),
      prop('right', transformExpression(node.right, tctx, depth + 1))
    ]);
  }

  // Comparison operators
  const cmpOp = COMPARISON_OPS[opKind];
  if (cmpOp !== undefined) {
    return transformComparisonExpression(node, cmpOp, tctx, depth);
  }

  emitDiagnostic(
    tctx.ctx,
    node.operatorToken,
    `${tctx.methodName}() predicate: operator "${syntaxKindName(opKind)}" is not supported. ` +
      'Use only: ===, !==, ==, !=, >, <, >=, <=, &&, ||.',
    ts.DiagnosticCategory.Error
  );
  return makeUnsupported(node.operatorToken);
}

function transformComparisonExpression(
  node: ts.BinaryExpression,
  cmpOp: string,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  const leftIsNull = isNullLiteral(node.left);
  const rightIsNull = isNullLiteral(node.right);

  // IS NULL / IS NOT NULL detection
  if (leftIsNull || rightIsNull) {
    const propSide = leftIsNull ? node.right : node.left;
    if (ts.isPropertyAccessExpression(propSide)) {
      const chain = collectPropertyChain(propSide);
      if (chain !== null && chain.root === tctx.paramName) {
        const nodeType = cmpOp === '===' || cmpOp === '==' ? 'isNull' : 'isNotNull';
        return makeObject([
          prop('type', str(nodeType)),
          prop('property', buildPropertyNode(chain.segments, chain.hasOptional))
        ]);
      }
    }
  }

  // Regular comparison
  return makeObject([
    prop('type', str('binary')),
    prop('operator', str(cmpOp)),
    prop('left', transformExpression(node.left, tctx, depth + 1)),
    prop('right', transformExpression(node.right, tctx, depth + 1))
  ]);
}

// ─── Property access ──────────────────────────────────────────────────────────

function transformPropertyAccess(
  node: ts.PropertyAccessExpression,
  tctx: TransformContext
): ts.Expression {
  const chain = collectPropertyChain(node);
  if (chain === null) return makeUnsupported(node, tctx.ctx);

  const { root, segments, hasOptional } = chain;

  if (root !== tctx.paramName) {
    // External dotted reference: config.maxAge
    // Capture it as a ParameterRef
    const idx = tctx.parameters.length;
    tctx.parameters.push(node);
    return makeObject([prop('type', str('parameterRef')), prop('index', num(idx))]);
  }

  return buildPropertyNode(segments, hasOptional);
}

// ─── Identifier ───────────────────────────────────────────────────────────────

function transformIdentifier(node: ts.Identifier, tctx: TransformContext): ts.Expression {
  if (node.text === tctx.paramName) {
    emitDiagnostic(
      tctx.ctx,
      node,
      `${tctx.methodName}() predicate: bare parameter "${tctx.paramName}" without a property access is not supported. ` +
        `Use ${tctx.paramName}.propertyName instead.`,
      ts.DiagnosticCategory.Error
    );
    return makeUnsupported(node);
  }
  // External variable — capture as ParameterRef
  const idx = tctx.parameters.length;
  tctx.parameters.push(node);
  return makeObject([prop('type', str('parameterRef')), prop('index', num(idx))]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNullLiteral(node: ts.Expression): boolean {
  return node.kind === ts.SyntaxKind.NullKeyword;
}

function makeLiteral(value: ts.Expression): ts.ObjectLiteralExpression {
  return makeObject([prop('type', str('literal')), prop('value', value)]);
}

export function buildPropertyNode(
  segments: string[],
  optional = false
): ts.ObjectLiteralExpression {
  const props: ts.PropertyAssignment[] = [prop('type', str('property'))];

  if (segments.length === 1) {
    props.push(prop('name', str(segments[0] ?? '')));
  } else {
    props.push(prop('path', makeArray(segments.map((s) => str(s)))));
  }

  if (optional) {
    props.push(prop('optional', ts.factory.createTrue()));
  }

  return makeObject(props);
}

function extractPropertyNode(
  argNode: ts.Expression,
  paramName: string
): ts.ObjectLiteralExpression | null {
  if (!ts.isPropertyAccessExpression(argNode)) return null;
  const chain = collectPropertyChain(argNode);
  if (chain === null || chain.root !== paramName) return null;
  return buildPropertyNode(chain.segments, chain.hasOptional);
}
