import type { SqlParameter } from '@ts-linq/types';
import { AstSqlGenerationError } from '../errors';
import type { LiteralNode, MethodNode, ParameterRefNode } from '../ast/Nodes';
import { renderPropertyName, resolveParameterRef } from './BinaryVisitor';

export class MethodVisitor {
  public visit(
    node: MethodNode,
    inputParameters: readonly unknown[]
  ): { condition: string; parameters: SqlParameter[] } {
    const col = renderPropertyName(node.object);
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

    return { condition: `(${col} LIKE ?)`, parameters: [pattern] };
  }
}

function resolveArg(
  arg: LiteralNode | ParameterRefNode,
  inputParameters: readonly unknown[]
): unknown {
  if (arg.type === 'literal') return arg.value;
  return resolveParameterRef(arg, inputParameters);
}
