import { AstSqlGenerationError } from '@ts-linq/ast';
import type { LiteralNode, MethodNode, ParameterRefNode } from '@ts-linq/ast';
import { renderPropertyName, resolveParameterRef, type ColumnResolver } from './BinaryVisitor';
import type { ConditionFragment } from '@ts-linq/ast';

export class MethodVisitor {
  public visit(
    node: MethodNode,
    inputParameters: readonly unknown[],
    resolver?: ColumnResolver
  ): ConditionFragment {
    const col = renderPropertyName(node.object, resolver);
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
