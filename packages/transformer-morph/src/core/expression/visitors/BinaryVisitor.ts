import * as ts from 'typescript';

import { reportDiagnostic } from '../../diagnostics';
import { makeObject, makeUnsupported, prop, str, syntaxKindName } from '../../nodes/builders';
import { buildPropertyNode, collectPropertyChain } from '../../nodes/PropertyChain';
import type { TransformContext } from '../TransformContext';

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

function isNullLiteral(node: ts.Expression): boolean {
  return node.kind === ts.SyntaxKind.NullKeyword;
}

export function visit(
  node: ts.BinaryExpression,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  const opKind = node.operatorToken.kind;

  const logicalOp = LOGICAL_OPS[opKind];
  if (logicalOp !== undefined) {
    return makeObject([
      prop('type', str('logical')),
      prop('operator', str(logicalOp)),
      prop('left', tctx.recurse(node.left, depth + 1)),
      prop('right', tctx.recurse(node.right, depth + 1))
    ]);
  }

  const cmpOp = COMPARISON_OPS[opKind];
  if (cmpOp !== undefined) {
    return visitComparison(node, cmpOp, tctx, depth);
  }

  reportDiagnostic(
    tctx.sink,
    node.operatorToken,
    `${tctx.methodName}() predicate: operator "${syntaxKindName(opKind)}" is not supported. ` +
      'Use only: ===, !==, ==, !=, >, <, >=, <=, &&, ||.',
    ts.DiagnosticCategory.Error
  );
  // Diagnostic already emitted above; pass methodName only (no sink) to keep the
  // sentinel description method-accurate without double-reporting.
  return makeUnsupported(node.operatorToken, { methodName: tctx.methodName });
}

function visitComparison(
  node: ts.BinaryExpression,
  cmpOp: string,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  const leftIsNull = isNullLiteral(node.left);
  const rightIsNull = isNullLiteral(node.right);

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

  return makeObject([
    prop('type', str('binary')),
    prop('operator', str(cmpOp)),
    prop('left', tctx.recurse(node.left, depth + 1)),
    prop('right', tctx.recurse(node.right, depth + 1))
  ]);
}
