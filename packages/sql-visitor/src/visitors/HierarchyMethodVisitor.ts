import type { MethodNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { HierarchyIdTranslator } from '@ts-linq/types';

import { ParameterState, ParameterStyle } from '../ParameterStyle';
import type { ConditionFragment } from '../types';
import { type ColumnResolver, renderPropertyName, resolveParameterRef } from './BinaryVisitor';

export type { HierarchyIdTranslator };

const HIERARCHY_METHODS = new Set(['isDescendantOf', 'getLevel', 'getAncestor']);

export function isHierarchyMethod(method: string): boolean {
  return HIERARCHY_METHODS.has(method);
}

export class HierarchyMethodVisitor {
  constructor(private readonly translator: HierarchyIdTranslator) {}

  public visit(
    node: MethodNode,
    inputParameters: readonly unknown[],
    resolver?: ColumnResolver,
    state: ParameterState = new ParameterState(ParameterStyle.Question)
  ): ConditionFragment {
    const col = renderPropertyName(node.object, resolver);

    switch (node.method) {
      case 'getLevel': {
        return { condition: this.translator.getLevel(col), parameters: [] };
      }
      case 'isDescendantOf':
      case 'getAncestor': {
        const arg0 = node.args[0];
        if (arg0 === undefined) {
          throw new AstSqlGenerationError(
            'INVALID_METHOD_NODE',
            `HierarchyId method "${node.method}" requires one argument.`,
            { nodeType: 'method', method: node.method }
          );
        }
        const rawValue =
          arg0.type === 'literal' ? arg0.value : resolveParameterRef(arg0, inputParameters);
        const placeholder = state.next();
        const sql =
          node.method === 'isDescendantOf'
            ? this.translator.isDescendantOf(col, placeholder)
            : this.translator.getAncestor(col, placeholder);
        return {
          condition: sql,
          parameters: [rawValue as import('@ts-linq/types').SqlParameter]
        };
      }
      default:
        throw new AstSqlGenerationError(
          'UNSUPPORTED_METHOD',
          `HierarchyMethodVisitor received non-hierarchy method: "${node.method}".`,
          { nodeType: 'method', method: node.method }
        );
    }
  }
}
