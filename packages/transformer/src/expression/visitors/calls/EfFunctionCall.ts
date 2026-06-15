import * as ts from 'typescript';

import { makeArray, makeObject, num, prop, str } from '../../../nodes/builders';
import { buildPropertyNode, collectPropertyChain } from '../../../nodes/PropertyChain';
import type { TransformContext } from '../../TransformContext';
import { EF_FUNCTIONS, isEfFunctionsCall, literalToAstNode } from './shared';

/**
 * Pattern D — `EF.functions.xxx(...)` markers rewritten into an `EfFunctionNode`,
 * e.g. `EF.functions.like(p.title, "%urgent%")`.
 */
export function tryVisit(
  node: ts.CallExpression,
  tctx: TransformContext,
  _depth: number
): ts.Expression | null {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;

  const callee = node.expression;
  const method = callee.name.text;

  if (!(EF_FUNCTIONS.has(method) && isEfFunctionsCall(callee))) {
    return null;
  }

  const argExprs = Array.from(node.arguments).map((a) => resolveEfArg(a, tctx));

  return makeObject([
    prop('type', str('efFunction')),
    prop('fn', str(method)),
    prop('args', makeArray(argExprs))
  ]);
}

/**
 * Resolve a single `EF.functions.*` argument into an AST node:
 * - an entity property access (rooted at the lambda parameter) → `PropertyNode`;
 * - a supported literal → `LiteralNode` (via the shared {@link literalToAstNode});
 * - anything else (runtime value, e.g. `new Date()` or a variable) → captured
 *   `parameterRef`.
 */
function resolveEfArg(argNode: ts.Expression, tctx: TransformContext): ts.Expression {
  // Entity property access: p.title → PropertyNode
  if (ts.isPropertyAccessExpression(argNode)) {
    const chain = collectPropertyChain(argNode);
    if (chain !== null && chain.root === tctx.paramName) {
      return buildPropertyNode(chain.segments, chain.hasOptional);
    }
  }

  // Supported literal → LiteralNode
  const literal = literalToAstNode(argNode);
  if (literal !== null) {
    return makeObject([prop('type', str('literal')), prop('value', literal)]);
  }

  // Runtime value (e.g. `new Date()`, variable) → capture as ParameterRefNode
  const idx = tctx.parameters.length;
  tctx.parameters.push(argNode);
  return makeObject([prop('type', str('parameterRef')), prop('index', num(idx))]);
}
