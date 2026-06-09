import type { MethodNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { SpatialTranslator } from '@ts-linq/types';

import type { ConditionFragment } from '../types';
import type { NodeVisitor, VisitContext } from '../visitContext';
import { renderPropertyName, resolveParameterRef } from './BinaryVisitor';

export type { SpatialTranslator };

const SPATIAL_METHODS = new Set([
  'distance',
  'intersects',
  'within',
  'buffer',
  'area',
  'length',
  'contains'
]);

export function isSpatialMethod(method: string): boolean {
  return SPATIAL_METHODS.has(method);
}

export class SpatialMethodVisitor implements NodeVisitor<MethodNode> {
  constructor(private readonly translator: SpatialTranslator) {}

  public visit(node: MethodNode, ctx: VisitContext): ConditionFragment {
    const { inputParameters, resolver, state } = ctx;
    const col = renderPropertyName(node.object, resolver);

    switch (node.method) {
      case 'area':
      case 'length': {
        // Unary — no argument
        const sql =
          node.method === 'area' ? this.translator.area(col) : this.translator.length(col);
        return { condition: sql, parameters: [] };
      }
      case 'distance':
      case 'intersects':
      case 'within':
      case 'buffer':
      case 'contains': {
        // Binary — one geometry argument
        const arg0 = node.args[0];
        if (arg0 === undefined) {
          throw new AstSqlGenerationError(
            'INVALID_METHOD_NODE',
            `Spatial method "${node.method}" requires one argument.`,
            { nodeType: 'method', method: node.method }
          );
        }
        const rawValue =
          arg0.type === 'literal' ? arg0.value : resolveParameterRef(arg0, inputParameters);
        const placeholder = state.next();
        let sql: string;
        switch (node.method) {
          case 'distance':
            sql = this.translator.distance(col, placeholder);
            break;
          case 'intersects':
            sql = this.translator.intersects(col, placeholder);
            break;
          case 'within':
            sql = this.translator.within(col, placeholder);
            break;
          case 'buffer':
            sql = this.translator.buffer(col, placeholder);
            break;
          case 'contains':
            sql = this.translator.contains(col, placeholder);
            break;
          default:
            throw new AstSqlGenerationError(
              'UNSUPPORTED_METHOD',
              `Unsupported spatial method: "${node.method}".`,
              { nodeType: 'method', method: node.method }
            );
        }
        return { condition: sql, parameters: [rawValue as import('@ts-linq/types').SqlParameter] };
      }
      default:
        throw new AstSqlGenerationError(
          'UNSUPPORTED_METHOD',
          `SpatialMethodVisitor received non-spatial method: "${node.method}".`,
          { nodeType: 'method', method: node.method }
        );
    }
  }
}
