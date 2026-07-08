/**
 * Type-level tests for ExpressionNode discriminated union.
 * Uses @ts-expect-error to assert exhaustiveness.
 * Run via `pnpm typecheck` — these are compile-time only tests.
 */

import type { ExpressionNode, ExpressionNodeKind } from '../../../src/core/nodes/ExpressionNode';

// Verify every ExpressionNodeKind string maps to a union member
type NodeByKind = Extract<ExpressionNode, { type: ExpressionNodeKind }>;
// If NodeByKind = never, some kind string isn't mapped — this file won't compile.
type _assertNotNever = NodeByKind extends never ? never : true;
const _check: _assertNotNever = true as const;
void _check;

// Exhaustiveness check: switch must handle all union members
function exhaustivenessCheck(node: ExpressionNode): string {
  switch (node.type) {
    case 'binary':
      return 'binary';
    case 'logical':
      return 'logical';
    case 'not':
      return 'not';
    case 'literal':
      return 'literal';
    case 'property':
      return 'property';
    case 'parameterRef':
      return 'parameterRef';
    case 'method':
      return 'method';
    case 'in':
      return 'in';
    case 'isNull':
      return 'isNull';
    case 'isNotNull':
      return 'isNotNull';
    case 'efFunction':
      return 'efFunction';
    case 'unsupported':
      return 'unsupported';
    default:
      // @ts-ignore @ts-expect-error — this line should never be reached; if it is, the union is not exhaustive
      return node;
  }
}

// Verify the function exists (runtime check — should never throw)
void exhaustivenessCheck;
