import type { LiteralNode, MethodNode, ParameterRefNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { SqlParameter } from '@ts-linq/types';

import type { ConditionFragment } from '../types';
import type { NodeVisitor, VisitContext } from '../visitContext';
import { renderPropertyName, resolveParameterRef } from './BinaryVisitor';
import { type HierarchyMethodVisitor, isHierarchyMethod } from './HierarchyMethodVisitor';
import { isSpatialMethod, type SpatialMethodVisitor } from './SpatialMethodVisitor';

export class MethodVisitor implements NodeVisitor<MethodNode> {
  constructor(
    private readonly spatialVisitor?: SpatialMethodVisitor,
    private readonly hierarchyVisitor?: HierarchyMethodVisitor
  ) {}

  public visit(node: MethodNode, ctx: VisitContext): ConditionFragment {
    const { inputParameters, resolver, state } = ctx;
    if (isSpatialMethod(node.method)) {
      if (!this.spatialVisitor) {
        throw new AstSqlGenerationError(
          'UNSUPPORTED_METHOD',
          `Spatial method "${node.method}" requires a SpatialTranslator. Pass one via SqlVisitor options.`,
          { nodeType: 'method', method: node.method }
        );
      }
      return this.spatialVisitor.visit(node, ctx);
    }

    if (isHierarchyMethod(node.method)) {
      if (!this.hierarchyVisitor) {
        throw new AstSqlGenerationError(
          'UNSUPPORTED_METHOD',
          `HierarchyId method "${node.method}" requires a HierarchyIdTranslator. Pass one via SqlVisitor options.`,
          { nodeType: 'method', method: node.method }
        );
      }
      return this.hierarchyVisitor.visit(node, ctx);
    }

    // A JSON-owned nested property arrives as a JsonPathExpression. Render it through the
    // dialect's JsonPathTranslator via ctx.recurse (the same port BinaryVisitor uses), then wrap
    // the resulting scalar fragment in `LIKE ?`. The translator yields zero parameters.
    const objectParams: SqlParameter[] = [];
    let col: string;
    if (node.object.type === 'jsonPath') {
      const inner = ctx.recurse(node.object);
      col = inner.condition;
      objectParams.push(...inner.parameters);
    } else {
      col = renderPropertyName(node.object, resolver);
    }
    const arg0 = node.args[0];

    if (arg0 === undefined) {
      throw new AstSqlGenerationError(
        'INVALID_METHOD_NODE',
        `MethodNode "${node.method}" requires at least one argument.`,
        { nodeType: 'method', method: node.method }
      );
    }

    const rawValue = resolveArg(arg0, inputParameters);
    if (typeof rawValue !== 'string') {
      throw new AstSqlGenerationError(
        'INVALID_METHOD_ARG',
        `MethodNode "${node.method}" argument must be a string, got ${typeof rawValue}.`,
        { nodeType: 'method', method: node.method }
      );
    }

    let pattern: string;
    switch (node.method) {
      case 'includes':
        pattern = `%${rawValue}%`;
        break;
      case 'startsWith':
        pattern = `${rawValue}%`;
        break;
      case 'endsWith':
        pattern = `%${rawValue}`;
        break;
      default:
        throw new AstSqlGenerationError(
          'UNSUPPORTED_METHOD',
          `Unsupported string method: "${node.method}".`,
          { nodeType: 'method', method: node.method }
        );
    }

    return { condition: `(${col} LIKE ${state.next()})`, parameters: [...objectParams, pattern] };
  }
}

function resolveArg(
  arg: LiteralNode | ParameterRefNode,
  inputParameters: readonly unknown[]
): unknown {
  if (arg.type === 'literal') return arg.value;
  return resolveParameterRef(arg, inputParameters);
}
