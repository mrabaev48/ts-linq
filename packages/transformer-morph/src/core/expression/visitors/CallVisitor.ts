import type * as ts from 'typescript';

import { makeUnsupported } from '../../nodes/builders';
import type { TransformContext } from '../TransformContext';
import * as ArrayIncludesCall from './calls/ArrayIncludesCall';
import * as EfFunctionCall from './calls/EfFunctionCall';
import * as IdentifierIncludesCall from './calls/IdentifierIncludesCall';
import type { CallHandler } from './calls/shared';
import * as StringMethodCall from './calls/StringMethodCall';

/**
 * Ordered chain of call-pattern handlers. The order encodes precedence and mirrors
 * the original top-to-bottom `if`-guard chain: array-`includes` (B) →
 * identifier-`includes` (C) → string method (A) → `EF.functions.*` (D).
 */
const HANDLERS: readonly CallHandler[] = [
  ArrayIncludesCall.tryVisit,
  IdentifierIncludesCall.tryVisit,
  StringMethodCall.tryVisit,
  EfFunctionCall.tryVisit
];

/**
 * Rewrite a call expression by trying each pattern handler in order, returning the
 * first non-`null` result. When no handler recognises the call shape, fall back to a
 * method-aware `unsupported` sentinel.
 */
export function visit(
  node: ts.CallExpression,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  for (const handler of HANDLERS) {
    const result = handler(node, tctx, depth);
    if (result !== null) return result;
  }

  return makeUnsupported(node, { sink: tctx.sink, methodName: tctx.methodName });
}
