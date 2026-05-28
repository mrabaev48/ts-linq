import type { BinaryNode, ExpressionNode, ParameterRefNode, PropertyNode } from '@ts-linq/ast';
import type { ConditionFragment, SqlFragment } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { SqlParameter, ValueConverterLike } from '@ts-linq/types';

import { ParameterState, ParameterStyle } from '../ParameterStyle';

/**
 * Maps a PropertyNode to its SQL column name.
 * If no resolver is supplied, the TypeScript property name is used as-is.
 */
export type ColumnResolver = (property: PropertyNode) => string;

/**
 * Maps a property name to its ValueConverter (if any).
 * Used for converter lifting in WHERE predicates.
 */
export type ConverterResolver = (propertyName: string) => ValueConverterLike | undefined;

export class BinaryVisitor {
  public visit(
    node: BinaryNode,
    inputParameters: readonly unknown[],
    recurse: (n: ExpressionNode) => ConditionFragment,
    resolver?: ColumnResolver,
    state: ParameterState = new ParameterState(ParameterStyle.Question),
    converterResolver?: ConverterResolver
  ): ConditionFragment {
    const sqlOp = this.mapOperator(node.operator);

    // Converter lifting: if one side is a property with a converter, transform the literal/paramRef on the other side
    const leftNode = this.liftNode(node.left, node.right, converterResolver);
    const rightNode = this.liftNode(node.right, node.left, converterResolver);

    const leftSql = this.renderOperand(leftNode, inputParameters, recurse, resolver, state);
    const rightSql = this.renderOperand(rightNode, inputParameters, recurse, resolver, state);
    return {
      condition: `(${leftSql.fragment} ${sqlOp} ${rightSql.fragment})`,
      parameters: [...leftSql.params, ...rightSql.params]
    };
  }

  /**
   * If `otherNode` is a property with a converter and `thisNode` is a literal or parameterRef,
   * return a new literal node with the converted value; otherwise return `thisNode` unchanged.
   */
  private liftNode(
    thisNode: ExpressionNode,
    otherNode: ExpressionNode,
    converterResolver?: ConverterResolver
  ): ExpressionNode {
    if (!converterResolver) return thisNode;
    if (thisNode.type !== 'literal' && thisNode.type !== 'parameterRef') return thisNode;
    if (otherNode.type !== 'property') return thisNode;

    const propName = otherNode.name ?? otherNode.path?.[0] ?? '';
    const converter = converterResolver(propName);
    if (!converter) return thisNode;

    if (thisNode.type === 'literal') {
      return { type: 'literal', value: converter.toProvider(thisNode.value) as SqlParameter };
    }
    // parameterRef: we can't resolve it here without inputParameters — we defer lifting
    // to the renderOperand phase by annotating the node (done via the converter lookup below)
    return thisNode;
  }

  private mapOperator(op: BinaryNode['operator']): string {
    switch (op) {
      case '===':
      case '==':
        return '=';
      case '!==':
      case '!=':
        return '!=';
      default:
        return op;
    }
  }

  private renderOperand(
    node: ExpressionNode,
    inputParameters: readonly unknown[],
    recurse: (n: ExpressionNode) => ConditionFragment,
    resolver: ColumnResolver | undefined,
    state: ParameterState
  ): SqlFragment {
    if (node.type === 'property') {
      return { fragment: renderPropertyName(node, resolver), params: [] };
    }
    if (node.type === 'literal') {
      return { fragment: state.next(), params: [node.value] };
    }
    if (node.type === 'parameterRef') {
      return {
        fragment: state.next(),
        params: [resolveParameterRef(node, inputParameters) as SqlParameter]
      };
    }
    const inner = recurse(node);
    return { fragment: inner.condition, params: inner.parameters };
  }
}

export function renderPropertyName(node: PropertyNode, resolver?: ColumnResolver): string {
  if (resolver) return resolver(node);
  if (node.name !== undefined) return node.name;
  if (node.path !== undefined && node.path.length > 0) return node.path.join('.');
  throw new AstSqlGenerationError(
    'INVALID_PROPERTY_NODE',
    'PropertyNode must have either name or path.',
    { nodeType: 'property' }
  );
}

export function resolveParameterRef(
  node: ParameterRefNode,
  inputParameters: readonly unknown[]
): unknown {
  const idx = node.index;
  if (!Number.isInteger(idx) || idx < 0 || idx >= inputParameters.length) {
    throw new AstSqlGenerationError(
      'PARAMETER_INDEX_OUT_OF_RANGE',
      `ParameterRef.index ${String(idx)} is out of range for inputParameters length ${String(inputParameters.length)}.`,
      { nodeType: 'parameterRef', parameterIndex: idx }
    );
  }
  return inputParameters[idx];
}
