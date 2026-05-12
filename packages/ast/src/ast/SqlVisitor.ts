import type { SqlParameter } from '@ts-linq/types';
import { BinaryVisitor } from '../visitors/BinaryVisitor';
// SqlParameter import kept for the return type
import { LogicalVisitor } from '../visitors/LogicalVisitor';
import { UnaryVisitor } from '../visitors/UnaryVisitor';
import { NullVisitor } from '../visitors/NullVisitor';
import { InVisitor } from '../visitors/InVisitor';
import { MethodVisitor } from '../visitors/MethodVisitor';
import { AstSqlGenerationError } from '../errors';
import type { ExpressionNode } from './Nodes';

/**
 * Converts a compiled ExpressionNode tree into a SQL WHERE fragment with parameters.
 * Identifiers are not quoted; column name resolution is the caller's responsibility.
 */
export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();
  private readonly unary = new UnaryVisitor();
  private readonly null = new NullVisitor();
  private readonly in = new InVisitor();
  private readonly method = new MethodVisitor();

  public toSql(
    node: ExpressionNode,
    inputParameters: readonly unknown[] = []
  ): { condition: string; parameters: SqlParameter[] } {
    const recurse = (n: ExpressionNode) => this.toSql(n, inputParameters);

    switch (node.type) {
      case 'binary':
        return this.binary.visit(node, inputParameters, recurse);
      case 'logical':
        return this.logical.visit(node, recurse);
      case 'not':
        return this.unary.visit(node, recurse);
      case 'isNull':
        return this.null.visitIsNull(node);
      case 'isNotNull':
        return this.null.visitIsNotNull(node);
      case 'in':
        return this.in.visit(node, inputParameters);
      case 'method':
        return this.method.visit(node, inputParameters);
      case 'unsupported':
        throw new AstSqlGenerationError(
          'UNSUPPORTED_NODE_TYPE',
          `Unsupported expression in WHERE clause: ${node.description}`,
          { nodeType: node.type, syntaxKind: node.syntaxKind }
        );
      default:
        throw new AstSqlGenerationError(
          'UNSUPPORTED_NODE_TYPE',
          `Unsupported root node type: '${(node as ExpressionNode).type}'.`,
          { nodeType: (node as ExpressionNode).type }
        );
    }
  }
}
