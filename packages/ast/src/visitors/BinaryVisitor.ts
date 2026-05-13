import type { SqlParameter } from '@ts-linq/types';
import { AstSqlGenerationError } from '../errors';
import type { BinaryNode, ExpressionNode, LiteralNode, ParameterRefNode, PropertyNode } from '../ast/Nodes';

/**
 * Maps a PropertyNode to its SQL column name.
 * Called by SqlVisitor when converting AST property references to SQL identifiers.
 * If no resolver is supplied, the TypeScript property name is used as-is.
 */
export type ColumnResolver = (property: PropertyNode) => string;

export class BinaryVisitor {
  public visit(
    node: BinaryNode,
    inputParameters: readonly unknown[],
    recurse: (n: ExpressionNode) => { condition: string; parameters: SqlParameter[] },
    resolver?: ColumnResolver
  ): { condition: string; parameters: SqlParameter[] } {
    const sqlOp = this.mapOperator(node.operator);
    const leftSql = this.renderOperand(node.left, inputParameters, recurse, resolver);
    const rightSql = this.renderOperand(node.right, inputParameters, recurse, resolver);
    return {
      condition: `(${leftSql.fragment} ${sqlOp} ${rightSql.fragment})`,
      parameters: [...leftSql.params, ...rightSql.params],
    };
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
    recurse: (n: ExpressionNode) => { condition: string; parameters: SqlParameter[] },
    resolver?: ColumnResolver
  ): { fragment: string; params: SqlParameter[] } {
    if (node.type === 'property') {
      return { fragment: renderPropertyName(node, resolver), params: [] };
    }
    if (node.type === 'literal') {
      return { fragment: '?', params: [node.value] };
    }
    if (node.type === 'parameterRef') {
      return { fragment: '?', params: [resolveParameterRef(node, inputParameters) as SqlParameter] };
    }
    // Nested expression (e.g. coalesce, another binary — emit as subexpression)
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
