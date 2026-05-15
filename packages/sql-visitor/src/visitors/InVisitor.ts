import type { SqlParameter } from '@ts-linq/types';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { InNode } from '@ts-linq/ast';
import { renderPropertyName, resolveParameterRef, type ColumnResolver } from './BinaryVisitor';
import type { ConditionFragment } from '@ts-linq/ast';
import { ParameterState, ParameterStyle } from '../ParameterStyle';

export class InVisitor {
  public visit(
    node: InNode,
    inputParameters: readonly unknown[],
    resolver?: ColumnResolver,
    state: ParameterState = new ParameterState(ParameterStyle.Question)
  ): ConditionFragment {
    const col = renderPropertyName(node.property, resolver);

    if (node.values !== undefined) {
      if (node.values.length === 0) {
        return { condition: '(1 = 0)', parameters: [] };
      }
      const placeholders = node.values.map(() => state.next()).join(', ');
      const params = node.values.map((v) => v.value);
      return { condition: `(${col} IN (${placeholders}))`, parameters: params };
    }

    if (node.valuesRef !== undefined) {
      const arr = resolveParameterRef({ type: 'parameterRef', index: node.valuesRef }, inputParameters);
      if (!Array.isArray(arr)) {
        throw new AstSqlGenerationError(
          'INVALID_IN_VALUES',
          `IN valuesRef[${String(node.valuesRef)}] must be an array, got ${typeof arr}.`,
          { nodeType: 'in', parameterIndex: node.valuesRef }
        );
      }
      if (arr.length === 0) {
        return { condition: '(1 = 0)', parameters: [] };
      }
      const placeholders = (arr as unknown[]).map(() => state.next()).join(', ');
      return { condition: `(${col} IN (${placeholders}))`, parameters: arr as SqlParameter[] };
    }

    throw new AstSqlGenerationError(
      'INVALID_IN_NODE',
      'InNode must have either values or valuesRef.',
      { nodeType: 'in' }
    );
  }
}
